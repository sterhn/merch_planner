# Merch Planner

A small web app for tracking a merch shop: **orders, catalog, collects (production runs), and expenses**. Works on phone and laptop — same data everywhere.

- Frontend: React + Vite, hosted free on **GitHub Pages**
- Data + login: **Supabase** (free tier)
- Your old Excel data can be imported with a one-time script

---

## One-time setup (~15 minutes)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign up (free).
2. Create a **New project** (any name, e.g. `merch-planner`). Pick a strong database password (you won't need it again) and a region near you.
3. Wait a minute for the project to be created.

### 2. Create the database tables

1. In your Supabase project, open **SQL Editor** (left sidebar).
2. Open the file [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) from this repo, copy **all** of it, paste into the editor, press **Run**.
3. You should see "Success. No rows returned".
4. Repeat for each remaining file in [`supabase/migrations/`](supabase/migrations/) in numeric order (`002` onwards). Each file starts with a comment saying what it adds.

> **Already set up earlier?** Only run the migration files you haven't run yet, in numeric order. From migration 010 on, the app knows which ones you've run: if the database is behind, a red **"Database update needed"** banner tells you which files to paste.

### 3. Create your login & lock the door

1. **Authentication → Sign In / Up → Email**: turn **OFF** "Allow new users to sign up". (Only you should ever have access.)
2. **Authentication → Users → Add user → Create new user**: enter your email and a password. This is what you'll use to log in to the app.

### 4. Connect the app to your Supabase

1. In Supabase: **Settings → API**. Copy the **Project URL** and the **anon public** key.
2. In this GitHub repo: **Settings → Secrets and variables → Actions → Variables tab → New repository variable**:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon key
3. Still in repo settings: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Go to the **Actions** tab → "Deploy to GitHub Pages" → **Run workflow** (or just push any commit).
5. When it's green, your app is live at **https://sterhn.github.io/merch_planner/**

### 5. Import your spreadsheet (optional but recommended)

You need [Node.js](https://nodejs.org) installed on your computer.

```bash
git clone https://github.com/sterhn/merch_planner.git
cd merch_planner
npm install

# First, a dry run — parses the file and shows what it found, inserts nothing:
npx tsx scripts/import.ts path/to/your-spreadsheet.xlsx --dry-run

# Then the real import. Get the service_role key from Supabase Settings → API.
SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
npx tsx scripts/import.ts path/to/your-spreadsheet.xlsx
```

⚠️ The **service_role** key bypasses all security — only use it in this local command, never put it in the app, GitHub, or anywhere online.

The import reads your sheets (предзаказы, всего мерча, коллекты, полки), matches order items to the catalog where it can, and keeps unmatched ones as free text. Re-running with `--force` wipes and re-imports everything.

### 6. On your phone

Open **https://sterhn.github.io/merch_planner/** in the browser, log in, then use **"Add to Home Screen"** — it installs like an app.

---

## Day-to-day

| Section | What it's for |
|---|---|
| **Dashboard** | Revenue vs expenses (counted in the month an order was paid), unpaid/unsent counts, collect pay-by and arrival dates, low stock, backup reminder |
| **Orders** | Pre-orders: contact, items, shipping & discount, paid → sent → delivered, delivery method & address. "Mark all as sent" on the To send list |
| **Catalog** | All your merch with cost, price, auto-profit, and stock. Archive items you no longer sell |
| **Collects** | Production runs: costs, pay-by and arrives-by dates, paid; total & per-unit cost auto-computed |
| **Expenses** | Manual expense log (tap to edit) + paid collects shown automatically ("from collects") |
| **Settings** | Download a backup, low-stock alert level, database version, sign out |

An order's **total** is worked out for you: items + shipping − discount. Tick "Set total by hand" on the order to type your own instead.

Marking an order **sent** decreases catalog stock for its items (and restores it if you un-mark sent). Adding, removing or changing items on an order that's already sent adjusts stock too.

**Archive vs delete:** archiving hides an item from the catalog and pickers but keeps it on old orders and collects. Delete only things you added by mistake.

(The consignment shelf was retired in Aug 2026 — its history still counts towards revenue on the dashboard.)

The app is a PWA: after the first visit it loads instantly and shows your latest cached data even offline (changes still need a connection).

## Development

```bash
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm install
npm run dev                  # local dev server
npm test                     # unit tests
npm run build                # production build
```

### Backup and restore

**Settings → Download backup** saves every table as one JSON file (photos stay in Supabase storage). The dashboard reminds you when the last backup is over 30 days old.

To put a backup back (uses the service_role key — keep it local):

```bash
npx tsx scripts/restore-backup.ts merch-planner-backup-2026-10-14.json --dry-run   # see what's in it

SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
npx tsx scripts/restore-backup.ts merch-planner-backup-2026-10-14.json
```

Rows are written back by id; anything created after the backup is left alone.

### Database health check

Verifies migrations, storage buckets, and SKUs (uses the service_role key, same as the import — keep it local):

```bash
SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
npx tsx scripts/check-db.ts            # read-only report

# … and to write the SKUs it proposes for items that have none:
npx tsx scripts/check-db.ts --fix-skus
```
