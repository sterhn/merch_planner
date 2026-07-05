-- Bundle composition table: links a bundle item to its component items.
create table bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references items(id) on delete cascade,
  component_id uuid not null references items(id) on delete cascade,
  qty integer not null default 1
);

create index bundle_items_bundle_id_idx on bundle_items(bundle_id);

alter table bundle_items enable row level security;
create policy "authenticated full access" on bundle_items
  for all to authenticated using (true) with check (true);
