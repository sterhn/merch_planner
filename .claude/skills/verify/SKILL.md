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

Gotchas: `pkill` at the end of a compound command kills the shell itself (exit 144) —
run cleanup separately.
