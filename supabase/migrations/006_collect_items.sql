-- Collect positions: what a production run contains, so arrived collects can
-- flow into the catalog. Each position is either a link to an existing item
-- (restock) or a free-text name (becomes a new catalog item on receive).

create table collect_items (
  id uuid primary key default gen_random_uuid(),
  collect_id uuid not null references collects(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  name_text text,
  qty integer not null default 1,
  created_at timestamptz not null default now()
);

create index collect_items_collect_id_idx on collect_items(collect_id);

alter table collect_items enable row level security;
create policy "authenticated full access" on collect_items
  for all to authenticated using (true) with check (true);

-- Set when the collect arrived and its positions were applied to the catalog,
-- so stock is never added twice.
alter table collects add column if not exists received_at timestamptz;
