-- Per-position print cost (₽ per piece) on collect positions. Used to set the
-- cost price of items created on receive; commission/delivery overhead is
-- still spread evenly per unit on top.
alter table collect_items add column if not exists print_cost numeric(10,2);
