-- Bundle-aware stock sync + delivery method constraint removal.

-- The delivery method list is managed by the app (src/lib/types.ts) and has
-- already outgrown the original check constraint ('озон' was added by hand in
-- production). Drop the constraint so fresh installs match reality.
alter table orders drop constraint if exists orders_delivery_method_check;

-- Extend the "sent" stock sync: an order line for a bundle also consumes its
-- components' stock (line qty × component qty per bundle_items). Un-marking
-- "sent" restores components the same way. The bundle's own stock_qty row is
-- still adjusted by the first update, same as before.
create or replace function apply_order_stock() returns trigger
language plpgsql as $$
declare
  delta integer := case when new.sent then -1 else 1 end;
begin
  update items i
  set stock_qty = coalesce(i.stock_qty, 0) + delta * s.total_qty
  from (
    select item_id, sum(qty) as total_qty
    from order_items
    where order_id = new.id and item_id is not null
    group by item_id
  ) s
  where s.item_id = i.id;

  update items i
  set stock_qty = coalesce(i.stock_qty, 0) + delta * s.total_qty
  from (
    select b.component_id as item_id, sum(oi.qty * b.qty) as total_qty
    from order_items oi
    join bundle_items b on b.bundle_id = oi.item_id
    where oi.order_id = new.id
    group by b.component_id
  ) s
  where s.item_id = i.id;

  return new;
end;
$$;
