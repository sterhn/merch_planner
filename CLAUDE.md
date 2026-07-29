# Merch Planner

Personal single-user merch shop tracker (orders, catalog, production runs, consignment shelf, expenses). Bilingual context: UI is English, data contains Russian (₽, ru-RU dates, Cyrillic item names).

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
- Supabase (data + auth + storage) with TanStack Query; generic CRUD hooks in `src/hooks/useTable.ts`
- Icons: lucide-react (import icons individually). Fonts: Manrope Variable (body) + Lora Variable (display) — replacements must keep Cyrillic coverage.

### Tokens

- Surfaces & ink: `bg-page`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-muted`, `text-ink-faint`, `border-line`
- Colour: `bg-brand`, `bg-brand-strong`, `bg-accent`, `bg-sun`, `text-good`, `text-bad`
- **Foregrounds on filled surfaces: `text-on-brand`, `text-on-brand-strong`, `text-on-accent`, `text-on-good`, `text-on-bad`.** Never `text-white` on a `bg-brand`/`bg-accent`/`bg-good`/`bg-bad` fill — those fills become *light* in dark mode, and white on them lands near 1.8:1.
- Type: `text-2xs` (11px) and `text-3xs` (10px) below Tailwind's `text-xs` — no arbitrary `text-[10px]`
- Radius: `rounded-control`, `rounded-card`, `rounded-sheet`. Elevation: `shadow-card`, `shadow-nav`. Scrim: `bg-scrim`. Focus ring: `--color-focus` (applied globally, don't re-add per component)
- Motion: `animate-sheet-up`, `animate-sheet-down`, `animate-pop`, `animate-fade-in`, `animate-fade-out`, and the `tap` press utility
- Never raw `gray-*`, `bg-white`, `text-red-*`, `text-green-*`.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build`
- `npm test` — vitest
- `npm run lint` — eslint (strict react-hooks rules: no sync setState in effects, no impure calls in render)

All of build, test, and lint must pass before pushing. Deploys to GitHub Pages happen from `main`.

## Design system pointers

- Shared components: `src/components/`
  - Page scaffolding: `PageHeader.tsx` (title + action slot), `QueryState.tsx` (the loading/error/empty triad — pass the query's flags, it renders nothing once there's data), `Card.tsx` (+ `SectionLabel`), `EmptyState.tsx`
  - Controls: `FormField.tsx` (`inputClass`, `textareaClass`, `Field`, `PrimaryButton`, `DangerButton`, `SecondaryButton`, `AddButton`, `IconButton`), `SearchInput.tsx`, `FilterChip.tsx`, `StatusBadge.tsx`
  - Display: `StatTile.tsx`, `OrderStatus.tsx`, `AnimatedNumber.tsx`, `ExpenseChart.tsx`, `CatalogPicker.tsx`
  - Behaviour: `Modal.tsx` (animated bottom sheet), `SwipeableRow.tsx`, `Toast.tsx`
- Reach for the shared component before hand-rolling markup — the page header, the loading/error/empty triad, stat tiles and icon buttons each existed in five or six copies before they were extracted.
- `SwipeableRow` ignores mouse pointers, so any swipe-only action also needs a visible button fallback for desktop.
- Haptics: `src/lib/haptics.ts` — call `haptic()` on key taps/toggles
- Touch targets ≥ 44px; inputs use 16px text (`text-base`) so iOS doesn't zoom on focus
