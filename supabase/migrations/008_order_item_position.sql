-- Explicit display order for order lines so they can be rearranged in the UI.
-- Backfilled from the current created_at ordering; new lines append at the end.
alter table order_items add column if not exists position integer;

update order_items oi
set position = sub.rn
from (
  select id, row_number() over (partition by order_id order by created_at, id) - 1 as rn
  from order_items
) sub
where oi.id = sub.id and oi.position is null;
