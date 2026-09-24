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
- Supabase (data + auth + storage) with TanStack Query; generic CRUD hooks in `src/hooks/useTable.ts`. PostgREST silently caps a read at 1000 rows: `useList` pages past it through `src/lib/readAll.ts`, and any other select that can grow unbounded should go through `readAll` too (the Orders bulk print does)
- Stock moves in the database, never in the client: triggers take it when an order is marked sent and give it back when un-sent (003/005) or deleted while sent (009), and move the difference when a sent order's lines are added, removed or re-counted (011) — bundle components included. The client only invalidates `items` after such writes.
- Revenue is counted in the month an order was paid: `orders.paid_at` (010), stamped by a trigger when `paid` flips and editable as "Paid on" in the order's details. Rows read before 010 is applied have no `paid_at` key, so code falls back to `created_at` and must never write `paid_at` unasked (`detailsChanges` in `src/lib/orderDetails.ts` sends only edited fields).
- The order details form saves unsaved edits when it goes away (leaving, switching order, app hidden). Fields the user hasn't touched follow the order as it refetches (`followServer`), so a stale cached copy is never written back.
- Icons: lucide-react (import icons individually). Fonts: Manrope Variable (body) + Nunito Variable (display, weight 820 via `--font-display--font-variation-settings`) — replacements must keep Cyrillic coverage.

### Tokens

- Surfaces & ink: `bg-page`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-muted`, `text-ink-faint`, `border-line`
- Colour: `bg-brand`, `bg-brand-strong`, `bg-accent`, `bg-sun`, `text-good`, `text-bad`. Gradient twins `brand-2` / `brand-strong-2` sit at the same lightness as `brand` / `brand-strong`, so `bg-linear-to-br from-brand to-brand-2` keeps `text-on-brand` legible.
- Section pastels `sky`, `peach`: icon ink and `/15` tints only — too light for small text and no `on-*` pair.
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

Migrations in `supabase/migrations/` are NOT auto-applied: the owner pastes each new file into the Supabase SQL Editor by hand. If a change depends on a new migration, say so loudly in the PR/summary.

## Design system pointers

- Shared components: `src/components/`
  - Page scaffolding: `PageHeader.tsx` (title + action slot), `QueryState.tsx` (the loading/error/empty triad — pass the query's flags, it renders nothing once there's data), `Card.tsx` (+ `SectionLabel`), `EmptyState.tsx`
  - Controls: `FormField.tsx` (`inputClass`, `textareaClass`, `Field`, `PrimaryButton`, `DangerButton`, `SecondaryButton`, `AddButton`, `IconButton`), `SearchInput.tsx`, `FilterChip.tsx`, `StatusBadge.tsx`, `RowEditor.tsx` (`PickRowButton`, `AddRowButton` for editable row lists)
  - Display: `StatTile.tsx` (optional `icon`), `OrderStatus.tsx`, `AnimatedNumber.tsx`, `ExpenseChart.tsx`, `CatalogPicker.tsx`, `BrandMark.tsx` (logo), `LoadingDots.tsx` (the loading indicator — `QueryState` and `EmptyState spin` use it)
  - Behaviour: `Modal.tsx` (animated bottom sheet; traps focus, stacks — topmost sheet owns Escape/Tab), `ConfirmSheet.tsx` (`useConfirm` — themed replacement for `window.confirm`; never use the native dialog), `SwipeableRow.tsx`, `Toast.tsx` (`showToast(text, { label: 'Undo', onClick })` renders an action button)
- Reach for the shared component before hand-rolling markup — the page header, the loading/error/empty triad, stat tiles and icon buttons each existed in five or six copies before they were extracted.
- `SwipeableRow` ignores mouse pointers, so any swipe-only action also needs a visible button fallback for desktop.
- Haptics: `src/lib/haptics.ts` — call `haptic()` on key taps/toggles
- Celebration: `src/lib/confetti.ts` `celebrate(el?)` for happy moments (order status advanced, collect received). `StatusBadge` fires it when switched on. Respects reduced motion.
- Quick add: `?new=1` on Orders/Catalog/Collects/Expenses opens the add sheet (`useLaunchFlag`); the dashboard's quick-add row links there.
- Touch targets ≥ 44px for primary controls. Deliberate exceptions: `FilterChip` (36px) and `IconButton size={10}` (40px, inside list rows) — don't shrink anything else below 44px.
- Money inputs are `type="text" inputMode="decimal"` + `parseMoney` — never `type="number"`, which rejects the comma decimal separator a Russian keyboard produces. `parseMoney` also takes space thousands separators and a trailing ₽, so pasted "1 500 ₽" reads as 1500. Whole-number counts stay `type="number" inputMode="numeric"`.
- SKUs autofill from type + fandom via `src/lib/sku.ts` (`TYPE_ABBR`, `nextSku`: FANDOM-TYPE-NN, or FANDOM-NN for a type without a code) until the SKU is typed by hand.
- Inputs use 16px text (`text-base`) so iOS doesn't zoom on focus
