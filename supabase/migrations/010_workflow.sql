-- Workflow upgrades: schema version tracking, app settings, order timestamps
-- and computed totals, stock that follows edits to sent orders, collect
-- "arrives by" dates, archived catalog items, and atomic saves for bundle
-- parts and collect positions.
--
-- Existing installs: paste this whole file into the Supabase SQL Editor and run it.
-- Safe to re-run.

-- ── Schema version ──────────────────────────────────────────────────
-- The app reads the highest version here and shows a banner when the
-- database is behind the code. Every migration from now on ends by
-- inserting its own number.
create table if not exists schema_migrations (
  version integer primary key,
  applied_at timestamptz not null default now()
);

alter table schema_migrations enable row level security;
drop policy if exists "authenticated read" on schema_migrations;
create policy "authenticated read" on schema_migrations
  for select to authenticated using (true);

-- ── App settings ────────────────────────────────────────────────────
-- Small key/value store so preferences follow you between phone and laptop
-- (low-stock threshold, last backup date).
create table if not exists app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
drop policy if exists "authenticated full access" on app_settings;
create policy "authenticated full access" on app_settings
  for all to authenticated using (true) with check (true);

-- ── Orders: when it was paid / sent ─────────────────────────────────
-- Stamped by the database whenever the flag flips, so Revenue can count an
-- order in the month it was paid. Existing orders stay null ("unknown") and
-- the app falls back to the order's created date for them.
alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists sent_at timestamptz;

create or replace function stamp_order_status() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.paid then new.paid_at := coalesce(new.paid_at, now()); end if;
    if new.sent then new.sent_at := coalesce(new.sent_at, now()); end if;
  else
    if new.paid is distinct from old.paid then
      new.paid_at := case when new.paid then now() end;
    end if;
    if new.sent is distinct from old.sent then
      new.sent_at := case when new.sent then now() end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists order_status_stamps on orders;
create trigger order_status_stamps
  before insert or update of paid, sent on orders
  for each row
  execute function stamp_order_status();

-- ── Orders: computed totals ─────────────────────────────────────────
-- total_price = items + shipping − discount, kept up to date by the database
-- whenever lines change — unless total_manual is set, in which case the
-- typed total is left alone.
alter table orders add column if not exists shipping_fee numeric(10,2);
alter table orders add column if not exists discount numeric(10,2);
alter table orders add column if not exists total_manual boolean;

create or replace function order_items_total(p_order_id uuid) returns numeric
language sql stable as $$
  select coalesce(sum(qty * coalesce(unit_price, 0)), 0)
  from order_items
  where order_id = p_order_id
$$;

-- Existing totals that don't match their items were typed by hand (shipping,
-- a discount, a round number) — keep every one of them exactly as it is.
update orders o
set total_manual = (o.total_price is not null and o.total_price <> order_items_total(o.id))
where o.total_manual is null;

alter table orders alter column total_manual set default false;
alter table orders alter column total_manual set not null;

create or replace function compute_order_total() returns trigger
language plpgsql as $$
begin
  if not new.total_manual then
    new.total_price := order_items_total(new.id)
      + coalesce(new.shipping_fee, 0) - coalesce(new.discount, 0);
  end if;
  return new;
end;
$$;

drop trigger if exists order_total_compute on orders;
create trigger order_total_compute
  before update of shipping_fee, discount, total_manual on orders
  for each row
  execute function compute_order_total();

create or replace function refresh_order_total(p_order_id uuid) returns void
language sql as $$
  update orders
  set total_price = order_items_total(id) + coalesce(shipping_fee, 0) - coalesce(discount, 0)
  where id = p_order_id and not total_manual
$$;

create or replace function sync_order_total() returns trigger
language plpgsql as $$
begin
  if tg_op <> 'INSERT' then perform refresh_order_total(old.order_id); end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.order_id is distinct from old.order_id) then
    perform refresh_order_total(new.order_id);
  end if;
  return null;
end;
$$;

drop trigger if exists order_line_total_sync on order_items;
create trigger order_line_total_sync
  after insert or delete or update of qty, unit_price, order_id on order_items
  for each row
  execute function sync_order_total();

-- ── Stock follows edits to sent orders ──────────────────────────────
-- Migration 003 only moved stock when "sent" flipped, so adding, removing or
-- changing a line on an order that was already sent left stock wrong.
-- Now each line edit on a sent order moves stock too (bundles included).

create or replace function adjust_line_stock(p_item_id uuid, p_delta integer) returns void
language plpgsql as $$
begin
  if p_item_id is null or p_delta = 0 then return; end if;

  update items set stock_qty = coalesce(stock_qty, 0) + p_delta where id = p_item_id;

  update items i
  set stock_qty = coalesce(i.stock_qty, 0) + p_delta * s.qty
  from (
    select component_id, sum(qty) as qty
    from bundle_items
    where bundle_id = p_item_id
    group by component_id
  ) s
  where i.id = s.component_id;
end;
$$;

create or replace function sync_line_stock() returns trigger
language plpgsql as $$
begin
  -- Deleting a catalog item nulls item_id on its order lines (on delete set
  -- null). That isn't an edit to the order — leave stock alone.
  if tg_op = 'UPDATE' and new.item_id is null and old.item_id is not null
     and not exists (select 1 from items where id = old.item_id) then
    return null;
  end if;

  -- When a whole sent order is deleted, restore_order_stock (migration 009)
  -- already gave its stock back; by the time its lines cascade away the order
  -- row is gone, so the exists() checks below skip them.
  if tg_op <> 'INSERT' and exists (select 1 from orders where id = old.order_id and sent) then
    perform adjust_line_stock(old.item_id, old.qty);
  end if;
  if tg_op <> 'DELETE' and exists (select 1 from orders where id = new.order_id and sent) then
    perform adjust_line_stock(new.item_id, -new.qty);
  end if;
  return null;
end;
$$;

drop trigger if exists order_line_stock_sync on order_items;
create trigger order_line_stock_sync
  after insert or delete or update of item_id, qty, order_id on order_items
  for each row
  execute function sync_line_stock();

-- ── Collects: "pay by" vs "arrives by" ──────────────────────────────
-- `deadline` stays and means the payment deadline. arrives_by is when the
-- run is expected to arrive. paid_at is stamped when "paid" is ticked, so
-- the expense lands on the day you actually paid.
alter table collects add column if not exists arrives_by date;
alter table collects add column if not exists paid_at timestamptz;

create or replace function stamp_collect_paid() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.paid then new.paid_at := coalesce(new.paid_at, now()); end if;
  elsif new.paid is distinct from old.paid then
    new.paid_at := case when new.paid then now() end;
  end if;
  return new;
end;
$$;

drop trigger if exists collect_paid_stamp on collects;
create trigger collect_paid_stamp
  before insert or update of paid on collects
  for each row
  execute function stamp_collect_paid();

-- Same columns as before; only the collect date changes (paid date first,
-- then the old deadline fallback for collects paid before this migration).
create or replace view expense_feed
with (security_invoker = true) as
  select id, date, category, description, amount, 'manual' as source
  from expenses
  union all
  select
    id,
    coalesce(paid_at::date, deadline, created_at::date) as date,
    'collect' as category,
    coalesce(name, '') || case when vendor is not null then ' (' || vendor || ')' else '' end as description,
    total_cost as amount,
    'collect' as source
  from collects
  where paid;

-- ── Catalog: archive instead of delete ──────────────────────────────
-- Archived items drop out of the catalog list and every picker but stay
-- linked to the orders and collects that used them.
alter table items add column if not exists archived boolean not null default false;

-- ── Atomic saves for bundle parts and collect positions ─────────────
-- The app used to delete the old rows and insert the new ones as two
-- separate requests; if the insert failed, the rows were simply gone.
-- Each function runs as one transaction: all of it applies or none of it.

create or replace function save_bundle_items(p_bundle_id uuid, p_rows jsonb) returns void
language plpgsql as $$
begin
  delete from bundle_items where bundle_id = p_bundle_id;
  insert into bundle_items (bundle_id, component_id, qty)
  select p_bundle_id, (r->>'component_id')::uuid, coalesce((r->>'qty')::integer, 1)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
end;
$$;

create or replace function save_collect_items(p_collect_id uuid, p_rows jsonb) returns void
language plpgsql as $$
begin
  delete from collect_items where collect_id = p_collect_id;
  insert into collect_items (collect_id, item_id, name_text, qty, print_cost)
  select
    p_collect_id,
    nullif(r->>'item_id', '')::uuid,
    nullif(r->>'name_text', ''),
    coalesce((r->>'qty')::integer, 1),
    (r->>'print_cost')::numeric
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
end;
$$;

insert into schema_migrations (version) values (10) on conflict do nothing;
