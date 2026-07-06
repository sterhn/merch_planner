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
- Tailwind CSS v4, CSS-first: design tokens live in an `@theme` block in `src/index.css`. Use semantic tokens (`bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-muted`, `text-ink-faint`, `border-line`, `text-good`, `text-bad`, `bg-page`, `rounded-card`, `shadow-card`, `tap`) — never raw `gray-*`, `bg-white`, `text-red-*`, `text-green-*`. Tokens use `light-dark()`, so dark mode follows the system automatically with no `dark:` variants.
- Supabase (data + auth + storage) with TanStack Query; generic CRUD hooks in `src/hooks/useTable.ts`
- Icons: lucide-react (import icons individually). Fonts: Nunito Variable (body) + Unbounded Variable (display) — replacements must keep Cyrillic coverage.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build`
- `npm test` — vitest
- `npm run lint` — eslint (strict react-hooks rules: no sync setState in effects, no impure calls in render)

All of build, test, and lint must pass before pushing. Deploys to GitHub Pages happen from `main`.

## Design system pointers

- Shared components: `src/components/` — `FormField.tsx` (`inputClass`, `textareaClass`, `PrimaryButton`, `DangerButton`), `Modal.tsx` (animated bottom sheet), `StatusBadge.tsx`, `EmptyState.tsx`, `SwipeableRow.tsx`, `AnimatedNumber.tsx`, `Toast.tsx`
- Haptics: `src/lib/haptics.ts` — call `haptic()` on key taps/toggles
- Touch targets ≥ 44px; inputs use 16px text (`text-base`) so iOS doesn't zoom on focus
