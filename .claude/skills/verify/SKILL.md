---
name: verify
description: How to verify changes in this repo at runtime (no Supabase creds available in CI/remote sessions).
---

# Verifying merch_planner changes

The real app needs Supabase auth + data; remote sessions only have `.env.example`, so
logged-in pages can't be driven directly.

What works instead:

1. `npm install`, then `npm run dev -- --port 5199 --strictPort` (serves at
   `http://localhost:5199/merch_planner/` — note the base path).
2. For UI/rendering modules, add a temporary harness entry: a `verify-harness.html` in
   the repo root plus `src/verify-harness.ts` that imports `./index.css` (real tokens +
   fonts) and the module under test with mock data (Vite serves any root .html).
   Delete both files before committing.
3. Drive with Playwright: `npm install playwright-core` in the scratchpad and launch
   with `executablePath: '/opt/pw-browsers/chromium'` (the symlink itself, it points at
   the real binary). Signal completion via `document.title` and wait for it.
4. Mock item photos as canvas-generated `data:` URLs — outbound network is proxied and
   there are no real Supabase storage URLs available.

## Run the gate on Node 20 before pushing

CI pins `node-version: 20` (`.github/workflows/deploy.yml`); this box defaults to a
newer Node, so a green local run is not proof CI is green. Use `/opt/node20/bin` on
PATH for the final check.

The trap this hides: `src/lib/supabase.ts` calls `createClient()` at module scope, and
under Node < 22 `@supabase/realtime-js` throws for want of a global `WebSocket`. So any
test that transitively imports the Supabase client passes locally and fails in CI.
Keep unit tests on modules that don't reach it — that is why `sortRows` lives in
`src/lib/sortRows.ts` rather than in `useTable.ts` beside its only caller.

## Checking schema-dependent work without Supabase

The migrations in `supabase/migrations/` fully describe the schema, so a throwaway
local Postgres answers most schema questions — no project credentials, and nothing
touching real data. Postgres 16 is on the box at `/usr/lib/postgresql/16/bin`.

1. `initdb` must run as an unprivileged user (`su postgres`), and its data dir has to
   live somewhere `postgres` can traverse — `/var/tmp/...`, not the scratchpad, whose
   parents are root-only.
2. Before applying migrations, stub what Supabase provides: schemas `auth` and
   `storage`, `auth.uid()`, tables `storage.buckets` / `storage.objects`, the
   `pgcrypto` extension, and roles `anon` / `authenticated` / `service_role`. Without
   the storage stubs, `001` and `004` fail on their bucket inserts.
3. Apply with `-v ON_ERROR_STOP=1` per file so a mid-file failure is visible; psql
   otherwise commits the statements before the error and carries on.

Useful things this answers: whether the migrations still apply cleanly from scratch,
what a view really returns, and whether client-side logic matches Postgres semantics
(`src/hooks/useTable.test.ts` locks in null ordering derived this way).

To generate types: `npx supabase gen types typescript --db-url ...` shells out to
Docker, which is not running by default — start `dockerd` first, and point the URL at
the bridge address `172.17.0.1` rather than `127.0.0.1`, since the CLI connects from
inside a container.

**Never use a `service_role` key for any of this.** It bypasses RLS on real data, and
it is not what `gen types` authenticates with anyway (that wants a personal access
token). The local-Postgres route above needs no secrets at all.

Gotchas: `pkill` at the end of a compound command kills the shell itself (exit 144) —
run cleanup separately.
