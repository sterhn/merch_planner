-- Stock integrity fixes.
--
-- 1. Deleting a sent order now gives its stock back. The sync triggers only
--    fired on UPDATE of "sent", so deleting a sent order silently kept the
--    decrement — stock drifted down with every such delete.
-- 2. Receiving a collect becomes one transactional function. The app used to
--    do it as a series of client-side writes; a failure partway left stock
--    half-applied with received_at still null, and a retry double-counted.
--
-- Existing installs: paste this whole file into the Supabase SQL Editor and run it.

-- BEFORE delete, while the order's line rows still exist (they cascade away
-- with the order). Mirrors apply_order_stock()'s restore branch, bundles included.
create or replace function restore_order_stock() returns trigger
language plpgsql as $$
begin
  update items i
  set stock_qty = coalesce(i.stock_qty, 0) + s.total_qty
  from (
    select item_id, sum(qty) as total_qty
    from order_items
    where order_id = old.id and item_id is not null
    group by item_id
  ) s
  where s.item_id = i.id;

  update items i
  set stock_qty = coalesce(i.stock_qty, 0) + s.total_qty
  from (
    select b.component_id as item_id, sum(oi.qty * b.qty) as total_qty
    from order_items oi
    join bundle_items b on b.bundle_id = oi.item_id
    where oi.order_id = old.id
    group by b.component_id
  ) s
  where s.item_id = i.id;

  return old;
end;
$$;

create trigger order_stock_restore_on_delete
  before delete on orders
  for each row
  when (old.sent)
  execute function restore_order_stock();

-- The collect arrived: bump stock for linked positions, turn free-text
-- positions into new catalog items (cost = this collect's per-unit cost), and
-- stamp received_at — all in one transaction, so it either fully applies or
-- not at all, and can never be applied twice.
create or replace function receive_collect(p_collect_id uuid) returns void
language plpgsql as $$
declare
  c collects%rowtype;
  overhead numeric;
  overhead_per_unit numeric := 0;
  even_per_unit numeric;
  r record;
  new_item_id uuid;
begin
  select * into c from collects where id = p_collect_id for update;
  if not found then
    raise exception 'Collect % not found', p_collect_id;
  end if;
  if c.received_at is not null then
    raise exception 'This collect was already received — stock is already added.';
  end if;

  -- Overhead (commission + delivery) is spread evenly per piece; a position
  -- with its own print cost gets that + overhead, otherwise the even split.
  overhead := coalesce(c.commission, 0) + coalesce(c.delivery_cost, 0);
  if coalesce(c.qty, 0) > 0 then
    overhead_per_unit := overhead / c.qty;
    even_per_unit := (coalesce(c.print_cost, 0) + overhead) / c.qty;
  end if;

  -- Restock positions linked to existing catalog items.
  update items i
  set stock_qty = coalesce(i.stock_qty, 0) + s.total_qty
  from (
    select item_id, sum(qty) as total_qty
    from collect_items
    where collect_id = p_collect_id and item_id is not null
    group by item_id
  ) s
  where s.item_id = i.id;

  -- Free-text positions become new catalog items, then link back to their
  -- position so a future look at the collect shows the real item.
  for r in
    select id, name_text, qty, print_cost
    from collect_items
    where collect_id = p_collect_id and item_id is null and name_text is not null
  loop
    insert into items (name, cost_price, stock_qty)
    values (
      r.name_text,
      round(coalesce(r.print_cost + overhead_per_unit, even_per_unit), 2),
      r.qty
    )
    returning id into new_item_id;

    update collect_items set item_id = new_item_id where id = r.id;
  end loop;

  update collects set received_at = now() where id = p_collect_id;
end;
$$;
