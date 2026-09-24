-- When each order was paid, so the dashboard counts revenue in the month the
-- money came in rather than the month the order was created. A trigger keeps
-- it up to date: stamped when an order is marked paid, cleared when it's
-- unmarked. The app can also set it by hand (the order's "Paid on" field).
--
-- Existing installs: paste this whole file into the Supabase SQL Editor and run it.
-- Safe to re-run.

alter table orders add column if not exists paid_at timestamptz;

-- Orders already paid have no payment date on record. Their creation date is
-- the closest stand-in, and it's what revenue was counted by until now, so
-- past months keep their totals.
update orders set paid_at = created_at where paid and paid_at is null;

create or replace function stamp_paid_at() returns trigger
language plpgsql as $$
begin
  if not new.paid then
    new.paid_at := null;
  elsif tg_op = 'INSERT' then
    new.paid_at := coalesce(new.paid_at, now());
  elsif not old.paid then
    -- Just marked paid. An explicit paid_at in the same update wins.
    new.paid_at := coalesce(new.paid_at, now());
  end if;
  -- Otherwise it was paid already: keep paid_at, including a hand-set one.
  return new;
end;
$$;

drop trigger if exists order_paid_at on orders;
create trigger order_paid_at
  before insert or update of paid, paid_at on orders
  for each row
  execute function stamp_paid_at();
