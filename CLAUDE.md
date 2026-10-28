# Merch Planner

Personal single-user merch shop tracker (orders, catalog, production runs, expenses). Bilingual context: UI is English, data contains Russian (₽, ru-RU dates, Cyrillic item names).

The consignment-shelf feature is **archived** (owner moved off the shelf, Aug 2026): `src/pages/Shelf.tsx`, its route and nav entry are removed, but the `shelf_items` table and its data remain, and the dashboard still folds historical shelf income into Revenue. To bring it back, restore `Shelf.tsx` from git history and re-add the route + nav entry.

## Before starting ANY work — sync with main

The working branch may have been created from a stale snapshot. Always do this first:

```
git fetch origin main
git rebase origin/main   # or merge if the rebase conflicts badly
```

Report how many commits behind the branch was. Never build on a stale base — a past session lost significant time re-merging because its branch was cut ~25 commits behind main.

## Stack

- React 19 + TypeScript + Vite 8, HashRouter (GitHub Pages), PWA via vite-plugin-pwa (offline caching; keep woff2 in `globPatterns`)
- Tailwind CSS v4, CSS-first: design tokens live in an `@theme` block in `src/index.css`. Tokens use `light-dark()`, so dark mode follows the system automatically with no `dark:` variants.
- Supabase (data + auth + storage) with TanStack Query; generic CRUD hooks in `src/hooks/useTable.ts`. PostgREST caps a read at 1000 rows, so every list read pages through `fetchAllPages` (`src/lib/paging.ts`) with a stable `.order('id')`; ids that travel in a URL (`.in(...)`) go in `chunk`ed batches.
- Pages other than the dashboard are `React.lazy` in `App.tsx`; `Layout` wraps the outlet in `<Suspense>`.
- Icons: lucide-react (import icons individually). Fonts: Manrope Variable (body) + Nunito Variable (display, weight 820 via `--font-display--font-variation-settings`) — replacements must keep Cyrillic coverage.

### Tokens

- Surfaces & ink: `bg-page`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-muted`, `text-ink-faint`, `border-line`
- Colour: `bg-brand`, `bg-brand-strong`, `bg-accent`, `bg-sun`, `text-good`, `text-bad`. Gradient twins `brand-2` / `brand-strong-2` sit at the same lightness as `brand` / `brand-strong`, so `bg-linear-to-br from-brand to-brand-2` keeps `text-on-brand` legible.
- Section pastels `sky`, `peach`: icon ink and `/15` tints only — too light for small text and no `on-*` pair.
- Chart series: `chart-1` (purple), `chart-2` (orange) — stepped separately for dark mode and validated with the dataviz checker; strokes/fills only, never text. Single-measure bars use `chart-1`. `TrendChart` (lines + readout + table view), `BarList` (ranked one-hue bars), axis helpers in `components/chartScale.ts`.
- Small text on `surface-2` must be `ink-muted`, not `ink-faint` (2.9:1). Nothing red/ink sits straight on the foil — put it on glass.
- Tones: `src/components/tones.ts` (`TONE_BLOB` tinted icon blob, `TONE_TEXT`). Each top-level page has an icon + tone in `src/components/sections.ts`, shared by the nav and `PageHeader` (`icon`/`tone` props).
- **Foregrounds on filled surfaces: `text-on-brand`, `text-on-brand-strong`, `text-on-accent`, `text-on-good`, `text-on-bad`.** Never `text-white` on a `bg-brand`/`bg-accent`/`bg-good`/`bg-bad` fill — those fills become *light* in dark mode, and white on them lands near 1.8:1.
- Type: `text-2xs` (11px) and `text-3xs` (10px) below Tailwind's `text-xs` — no arbitrary `text-[10px]`
- **Surfaces are liquid glass.** `glass` (in `index.css`) is the panel utility: translucent `surface`, backdrop blur + saturate, a bright top rim, a diagonal sheen and `shadow-card`, all in one — don't add `bg-surface`/`shadow-*`/`ring-*` beside it (they fight it for the same properties). Tune opacity with `[--glass-fill:80%]`; flag a pane with `glass-alert` (red halo). The scenery behind is `Backdrop.tsx` (mounted once in `main.tsx`): a holographic-foil photo, `src/assets/holo-{light,dark}.webp` plus landscape `holo-{light,dark}-wide.webp` (the owner's own generated images, grain baked in), swapped by `prefers-color-scheme` and `orientation` media queries since images can't use `light-dark()`, under a thin `--holo-veil` of page colour that keeps faint text legible — the foil is what the glass picks up. The layer is `h-lvh`, not `inset-0` (mobile Chrome growing the screen as its address bar hides left a white strip), and `body` is painted `--holo-base`, the foil's average colour, so any gap blends in. Keep the WebPs small (they're precached by the PWA; `webp` is in `globPatterns`). Keep it static: anything animating under a backdrop-filter re-blurs every frame. Inputs and `Modal` sheets stay solid `bg-surface` for legibility (the modal's scrim is its backdrop root, so glass there would only blur grey). Filled brand buttons carry a `--glass-gloss` top edge. `backdrop-filter` makes an element a containing block for fixed descendants — never put `glass` on an ancestor of `Modal`.
- Radius: `rounded-control`, `rounded-card`, `rounded-sheet`. Elevation: `shadow-card`, `shadow-lift` (hover), `shadow-nav`. Scrim: `bg-scrim`. Focus ring: `--color-focus` (applied globally, don't re-add per component)
- Motion: `animate-sheet-up`, `animate-sheet-down`, `animate-pop`, `animate-fade-in`, `animate-fade-out`, `animate-page-in`, `animate-float`, `animate-wiggle`, `animate-boing`, `animate-twinkle`, `animate-dot`; the `tap` press utility and `lift` (hover-raise for tappable cards). Never put a transform animation on an ancestor of `Modal` — it isn't portalled, so a transformed ancestor becomes its containing block (why `animate-page-in` is opacity-only).
- Never raw `gray-*`, `bg-white`, `text-red-*`, `text-green-*`.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build`
- `npm test` — vitest
- `npm run lint` — eslint (strict react-hooks rules: no sync setState in effects, no impure calls in render)

All of build, test, and lint must pass before pushing. Deploys to GitHub Pages happen from `main`.

Migrations in `supabase/migrations/` are NOT auto-applied: the owner pastes each new file into the Supabase SQL Editor by hand. If a change depends on a new migration, say so loudly in the PR/summary. Every new migration must end with `insert into schema_migrations (version) values (N) on conflict do nothing;` and bump `SCHEMA_VERSION` in `src/hooks/useSettings.ts` to match — `Layout` shows a "Database update needed" banner while the database is behind. New columns read by the app should be optional in `src/lib/types.ts` (with a sensible fallback) so the app still loads before the owner runs the migration.

Data rules the database enforces (migrations 003/009/010), so the app doesn't duplicate them:
- Stock: marking an order sent takes its items off stock; un-sending, deleting the order, or editing lines on a sent order moves stock to match (bundles via their components).
- Order totals: `total_price` = items + `shipping_fee` − `discount`, recomputed on every line change, unless `total_manual`. Line mutations must invalidate `orders` (and `items`).
- `orders.paid_at`/`sent_at` and `collects.paid_at` are stamped by triggers; revenue counts in the paid month (`paid_at ?? created_at`).
- Collects have two dates: `deadline` = pay by, `arrives_by` = expected arrival.
- Bundle parts and collect positions are saved through the `save_bundle_items` / `save_collect_items` RPCs (one transaction), never delete-then-insert from the client.
- Items are archived (`archived`), not deleted, in normal use; pickers and low-stock skip archived items.

## Design system pointers

- Shared components: `src/components/`
  - Page scaffolding: `PageHeader.tsx` (title + action slot), `QueryState.tsx` (the loading/error/empty triad — pass the query's flags and a `skeleton` from `Skeleton.tsx` shaped like the list; it renders nothing once there's data), `Card.tsx` (+ `SectionLabel`), `EmptyState.tsx`. Skeleton bars pulse; glass panels never animate.
  - Controls: `FormField.tsx` (`inputClass`, `textareaClass`, `Field`, `PrimaryButton`, `DangerButton`, `SecondaryButton`, `AddButton`, `IconButton`, `QtyStepper` for − / + quantities), `SearchInput.tsx`, `FilterChip.tsx`, `StatusBadge.tsx`, `RowEditor.tsx` (`PickRowButton`, `AddRowButton` for editable row lists)
  - Display: `StatTile.tsx` (optional `icon`), `OrderStatus.tsx`, `AnimatedNumber.tsx`, `ExpenseChart.tsx`, `CatalogPicker.tsx`, `BrandMark.tsx` (logo), `LoadingDots.tsx` (the loading indicator — `QueryState` and `EmptyState spin` use it)
  - Behaviour: `Modal.tsx` (animated bottom sheet; traps focus, stacks — topmost sheet owns Escape/Tab; drag the handle/title row down to dismiss on touch), `ConfirmSheet.tsx` (`useConfirm` — themed replacement for `window.confirm`; never use the native dialog), `SwipeableRow.tsx`, `Toast.tsx` (`showToast(text, { label: 'Undo', onClick })` renders an action button; action toasts last 8 s, tap to dismiss), `RevealMore.tsx` + `hooks/useReveal.ts` (long lists render 40 rows and grow as the end nears — use for any list that can run to hundreds), `GlobalSearch.tsx` (⌘K / Ctrl+K, dashboard search icon on mobile; matching in `lib/search.ts`)
- Reach for the shared component before hand-rolling markup — the page header, the loading/error/empty triad, stat tiles and icon buttons each existed in five or six copies before they were extracted.
- `SwipeableRow` ignores mouse pointers, so any swipe-only action also needs a visible button fallback for desktop.
- Haptics: `src/lib/haptics.ts` — call `haptic()` on key taps/toggles
- Celebration: `src/lib/confetti.ts` `celebrate(el?)` for happy moments (order status advanced, collect received). `StatusBadge` fires it when switched on. Respects reduced motion.
- Quick add: `?new=1` on Orders/Catalog/Collects/Expenses opens the add sheet (`useLaunchFlag`); the dashboard's quick-add row links there. `/collects?open=<id>` opens one collect (dashboard dates, expense rows and search link there), `/catalog?open=<id>` one item's card, `/collects?new=1&items=a,b` a new collect with those positions ("Plan a reprint"; `useLaunchParam`).
- Navigation: `ScrollManager` (in `Layout`) opens a new page at the top and restores the offset on Back; tapping the current tab scrolls to top. Layout passes `{ openSearch }` to pages through the Outlet context (`LayoutContext`). Pages are preloaded on idle after login (`App.tsx`). The `AddButton` a page wants on the `N` shortcut carries `data-shortcut="new"`; `/` focuses the page's search (`useShortcuts`).
- Unsaved edits: `OrderDetailsForm` tracks dirty state (Save/Discard bar above the tab bar, a per-order draft kept for the session, `beforeunload` warning). Fixed bars like that must render outside any `glass` ancestor.
- Big editors live beside their page: `src/pages/order/` (details form, line sheets), `src/pages/catalog/ItemEditor.tsx`, `src/pages/collects/CollectEditor.tsx`. Editors mount only while open and start their form from props (`key` by id), instead of a parent holding the form state.
- Settings (`/settings`, `SETTINGS` in `sections.ts`) and Insights (`/insights`, `INSIGHTS`) are outside the 5-tab mobile bar: sidebar on desktop; on mobile, the dashboard header gear and the "Insights" link beside Overview. Insights maths lives in `lib/insights.ts` and must keep the dashboard's revenue rule.
- Packing (`/orders/pack`, from the To send list): pick list (`lib/packing.ts`) + per-order ticks kept in `viewState`. Customer message templates: `lib/customerMessages.ts` (Russian, no gendered past-tense verbs). Catalog sort: `lib/catalogSort.ts`; quick stock +/− batches taps in `useStockNudge`. Preferences live in the `app_settings` table (`useSettings`); list filters live in `src/lib/viewState.ts` (localStorage).
- Print/receipt HTML is built in `src/lib/printOrder.ts` (tested), not in pages.
- Text straight on the foil (not on glass) needs full `text-ink`; brand/red text there measured ~3:1, so links and totals that sit on the page background get a `glass` pill (back links, "Show more", expense month totals).
- Touch targets ≥ 44px for primary controls. Deliberate exceptions: `FilterChip` (36px) and `IconButton size={10}` (40px, inside list rows) — don't shrink anything else below 44px.
- Money inputs are `type="text" inputMode="decimal"` + `parseMoney` — never `type="number"`, which rejects the comma decimal separator a Russian keyboard produces. Whole-number counts stay `type="number" inputMode="numeric"`.
- Inputs use 16px text (`text-base`) so iOS doesn't zoom on focus
