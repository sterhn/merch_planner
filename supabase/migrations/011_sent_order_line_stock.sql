-- Stock follows the lines of an order that's already sent. Marking an order
-- sent (or un-sent) moves stock for all of its lines at once (003 / 005), and
-- deleting a sent order gives it back (009) — but adding a line afterwards,
-- removing one or changing its quantity left stock alone, so it drifted with
-- every late edit. Now each such edit takes or gives back the difference,
-- bundle components included, while the order is marked sent.
--
-- Existing installs: paste this whole file into the Supabase SQL Editor and run it.
-- Safe to re-run.

create or replace function sync_line_stock() returns trigger
language plpgsql as $$
declare
  line_item uuid;
  line_order uuid;
  taken integer; -- units this change takes from stock; negative gives back
begin
  if tg_op = 'INSERT' then
    line_item := new.item_id;
    line_order := new.order_id;
    taken := new.qty;
  elsif tg_op = 'DELETE' then
    line_item := old.item_id;
    line_order := old.order_id;
    taken := -old.qty;
  else
    line_item := new.item_id;
    line_order := new.order_id;
    taken := new.qty - old.qty;
  end if;

  -- Unsent orders move stock only when marked sent. A sent order being
  -- deleted is already gone by the time its lines cascade away, so this finds
  -- no sent order there and 009's restore isn't doubled.
  if line_item is null or taken = 0
     or not exists (select 1 from orders where id = line_order and sent) then
    return null;
  end if;

  update items set stock_qty = coalesce(stock_qty, 0) - taken where id = line_item;

  update items i
  set stock_qty = coalesce(i.stock_qty, 0) - taken * b.per_bundle
  from (
    select component_id, sum(qty) as per_bundle
    from bundle_items
    where bundle_id = line_item
    group by component_id
  ) b
  where b.component_id = i.id;

  return null;
end;
$$;

drop trigger if exists order_line_stock_insert on order_items;
create trigger order_line_stock_insert
  after insert on order_items
  for each row
  execute function sync_line_stock();

drop trigger if exists order_line_stock_delete on order_items;
create trigger order_line_stock_delete
  after delete on order_items
  for each row
  execute function sync_line_stock();

-- Quantity only. The app never re-points a line at another item; the one
-- thing that does is deleting a catalog item (item_id → null), and the goods
-- that left with the order shouldn't come back into stock for that.
drop trigger if exists order_line_stock_qty on order_items;
create trigger order_line_stock_qty
  after update of qty on order_items
  for each row
  when (old.qty is distinct from new.qty)
  execute function sync_line_stock();
