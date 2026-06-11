-- Merch Planner schema. Paste this whole file into the Supabase SQL Editor and run it.

create table items (
  id uuid primary key default gen_random_uuid(),
  type text,
  fandom text,
  sku text,
  name text not null,
  image_url text,
  cost_price numeric(10,2),
  sale_price numeric(10,2),
  profit numeric(10,2) generated always as (coalesce(sale_price, 0) - coalesce(cost_price, 0)) stored,
  stock_qty integer default 0,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_email text,
  telegram text,
  total_price numeric(10,2),
  comment text,
  paid boolean not null default false,
  delivery_method text check (
    delivery_method in ('почта', 'сдэк', 'яндекс', 'самовывоз мск', 'самовывоз спб')
    or delivery_method is null
  ),
  delivery_details text,
  sent boolean not null default false,
  delivered boolean not null default false,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  item_id uuid references items (id) on delete set null,
  name_text text,
  category text,
  qty integer not null default 1,
  unit_price numeric(10,2),
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on order_items (order_id);

create table collects (
  id uuid primary key default gen_random_uuid(),
  name text,
  vendor text,
  qty integer,
  print_cost numeric(10,2) default 0,
  commission numeric(10,2) default 0,
  delivery_cost numeric(10,2) default 0,
  deadline date,
  paid boolean not null default false,
  total_cost numeric(10,2) generated always as (
    coalesce(print_cost, 0) + coalesce(commission, 0) + coalesce(delivery_cost, 0)
  ) stored,
  cost_per_unit numeric(10,2) generated always as (
    case
      when coalesce(qty, 0) > 0
      then (coalesce(print_cost, 0) + coalesce(commission, 0) + coalesce(delivery_cost, 0)) / qty
    end
  ) stored,
  created_at timestamptz not null default now()
);

create table shelf_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2),
  month text,
  shop text,
  qty_sent integer default 0,
  qty_sold integer default 0,
  qty_remaining integer generated always as (coalesce(qty_sent, 0) - coalesce(qty_sold, 0)) stored,
  income numeric(10,2) generated always as (coalesce(qty_sold, 0) * coalesce(price, 0)) stored,
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  category text not null check (category in ('shelf_rent', 'supplies', 'shipping', 'other')),
  description text,
  amount numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- Manual expenses + paid collect costs in one read-only feed (no double entry).
create view expense_feed
with (security_invoker = true) as
  select id, date, category, description, amount, 'manual' as source
  from expenses
  union all
  select
    id,
    coalesce(deadline, created_at::date) as date,
    'collect' as category,
    coalesce(name, '') || case when vendor is not null then ' (' || vendor || ')' else '' end as description,
    total_cost as amount,
    'collect' as source
  from collects
  where paid;

-- Single-user model: public signups are disabled in the dashboard, so the
-- one manually created user gets full access; anon gets nothing.
alter table items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table collects enable row level security;
alter table shelf_items enable row level security;
alter table expenses enable row level security;

create policy "authenticated full access" on items
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on orders
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on order_items
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on collects
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on shelf_items
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on expenses
  for all to authenticated using (true) with check (true);

-- Storage bucket for item photos. Public read (images are served by URL),
-- only the authenticated user can upload or delete.
insert into storage.buckets (id, name, public) values ('item-images', 'item-images', true);

create policy "authenticated upload item images" on storage.objects
  for insert to authenticated with check (bucket_id = 'item-images');
create policy "authenticated update item images" on storage.objects
  for update to authenticated using (bucket_id = 'item-images');
create policy "authenticated delete item images" on storage.objects
  for delete to authenticated using (bucket_id = 'item-images');
create policy "public read item images" on storage.objects
  for select using (bucket_id = 'item-images');
