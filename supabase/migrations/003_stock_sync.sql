-- Auto stock sync. When an order is marked "sent", catalog stock decreases by
-- each order line's qty (only lines linked to a catalog item); un-marking
-- "sent" restores it.
--
-- Kept deliberately simple: adding or removing lines on an order that is
-- ALREADY sent does not adjust stock — fix the catalog stock manually in that
-- rare case.
--
-- Existing installs: paste this whole file into the Supabase SQL Editor and run it.

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
  return new;
end;
$$;

create trigger order_stock_sync
  after update of sent on orders
  for each row
  when (old.sent is distinct from new.sent)
  execute function apply_order_stock();
