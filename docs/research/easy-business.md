# Research: easy-business (reference app)

Source: `/Users/divyansh/Desktop/code/abizer-sir/easy-business` (below, paths are relative to it).
It is an offline-first invoicing PWA on SvelteKit. The user rates its design, theming, navigation and responsiveness as excellent. Everything here is read from source. There is **no CLAUDE.md**; the rules live in `docs/DESIGN.md`, `docs/UI-QA.md`, `docs/WAVE2.md`, `docs/ADMIN.md` and `docs/ARCHITECTURE.md`.

---

## 1. Stack and dependencies
`package.json`:
- **Runtime:** Bun, SvelteKit 3 (`@sveltejs/kit ^3`), Svelte 5 runes (forced on for every non-node_modules file in `vite.config.ts`), TypeScript 6 strict, `adapter-node`, Vite 8.
- **Styling:** Tailwind v4 (`@tailwindcss/vite`). All tokens live in one file, `src/app.css`.
- **Fonts:** `@fontsource-variable/inter` (body and numbers) and `@fontsource-variable/montserrat` (large titles and hero numbers only).
- **Icons:** `@lucide/svelte`. Emojis are banned.
- **Data:** Dexie (IndexedDB, the client source of truth) plus Drizzle + `postgres` (server, used for sync only). Zod 4 at every boundary.
- **Table:** `@tanstack/table-core` v9, headless and bridged to runes. No other UI or table library.
- **Other:** `jose` (JWT), `jspdf` (lazy-loaded PDF), `uqr` (QR), `nodemailer`.
- **Dev:** `playwright` + `@axe-core/playwright` for the UI audit scripts, `fake-indexeddb`, `bun test`.
- **Import alias:** `"imports": { "#lib": ..., "#lib/*": "./src/lib/*" }`.
- **Notable choice:** no chart library, no component library, no animation library. Everything is hand-rolled on tokens.

`vite.config.ts` notes:
- `paths: { relative: false }`, because the service worker serves one shell for every URL.
- `version: { pollInterval: 0 }`, because a custom update policy replaces SvelteKit's polling.

## 2. Design tokens, fonts, theme switch, accent, dark mode
**Token block** (`src/app.css`, verbatim core):
```css
:root {
	color-scheme: light dark;
	--hue: 302;
	--primary-l: oklch(0.52 0.19 302);
	--primary-d: oklch(0.72 0.11 302);
	--background: light-dark(oklch(0.985 0.003 var(--hue)), oklch(0.16 0.008 var(--hue)));
	--surface: light-dark(oklch(1 0 0), oklch(0.2 0.01 var(--hue)));
	--surface-2: light-dark(oklch(1 0 0), oklch(0.24 0.01 var(--hue)));   /* sheets */
	--surface-3: light-dark(oklch(1 0 0), oklch(0.28 0.012 var(--hue)));  /* menus */
	--foreground: light-dark(oklch(0.2 0.01 var(--hue)), oklch(0.94 0.005 var(--hue)));
	--muted: light-dark(oklch(0.955 0.005 var(--hue)), oklch(0.24 0.01 var(--hue)));
	--muted-foreground: light-dark(oklch(0.52 0.01 var(--hue)), oklch(0.7 0.01 var(--hue)));
	--border: light-dark(oklch(0.91 0.006 var(--hue)), oklch(0.3 0.012 var(--hue)));
	--primary: light-dark(var(--primary-l), var(--primary-d));
	--primary-foreground: light-dark(oklch(0.99 0 0), oklch(0.16 0.008 var(--hue)));
	--primary-soft: light-dark(oklch(0.95 0.03 var(--hue)), oklch(0.3 0.05 var(--hue)));
	--success: light-dark(oklch(0.5 0.13 155), oklch(0.74 0.11 155));
	--success-soft: light-dark(oklch(0.95 0.04 155), oklch(0.3 0.05 155));
	--warning: light-dark(oklch(0.5 0.13 70), oklch(0.8 0.11 80));
	--warning-soft: light-dark(oklch(0.96 0.05 85), oklch(0.32 0.05 80));
	--destructive: light-dark(oklch(0.5 0.19 27), oklch(0.7 0.14 25));
	--ring: color-mix(in oklab, var(--primary) 45%, transparent);
	--radius: 0.75rem;
}
@supports not (color: light-dark(white, black)) { :root { /* light-only fallback values */ } }
:root[data-theme='light'] { color-scheme: light; }
:root[data-theme='dark']  { color-scheme: dark; }
:root[data-accent='blue'] { --hue: 262; --primary-l: oklch(0.52 0.17 262); --primary-d: oklch(0.72 0.11 262); }
/* also emerald 162, rose 12, amber 60 (primary hue 55/70), slate 260 (chroma 0.03) */
@theme inline {
	--font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
	--font-display: 'Montserrat Variable', ui-sans-serif, system-ui, sans-serif;
	--color-background: var(--background); /* ...every token mapped to --color-* */
	--radius-sm: 6px; --radius-md: 10px; --radius-lg: 12px; --radius-xl: 16px;
}
```
**How it works**
- **One block covers both modes.** Every color is `light-dark(light, dark)`, resolved from `color-scheme`. Dark mode is never a second token block. Browsers without `light-dark()` (iOS < 17.5) get light-only fallbacks.
- **Mode:** with no `data-theme` attribute the app follows the system. `data-theme="light"` or `"dark"` forces a mode by flipping `color-scheme`.
- **Accent:** `data-accent` on `<html>` sets `--hue`, which tints *all neutrals* too, plus `--primary-l`/`--primary-d`. Each pair is AA-checked (at least 5.3:1).
- **Dark elevation comes from lightness, not shadow:** background 0.16, then surface 0.20, sheet 0.24, menu 0.28. There is no pure black and no lavender fills. `primary-soft` is only for the selected chip or nav item, never a card fill (DESIGN §3).
- **No flash on load:** an inline script in `src/app.html` sets `data-platform` (ios, android or desktop), `data-theme` and `data-accent` and fixes `<meta name="theme-color">` before first paint. It reads the localStorage keys `theme-mode` and `theme-accent`. There are two theme-color metas, one per `prefers-color-scheme`.
- **Runtime store:** `src/lib/components/theme.svelte.ts` holds `theme = $state({mode, accent})`, `setMode()`, `setAccent()` and `ACCENTS[]` (id, label, swatch).
  - `apply()` adds `.theme-switching` to `<html>` for 250 ms, so every color crossfades over 200 ms (`app.css` rule with `transition ... !important`). It skips this under reduced motion.
- **Pickers:** `features/settings/components/AccentPicker.svelte` (swatches) is in settings. The admin top bar has a cycling icon button (system to light to dark; Monitor, Sun, Moon).
- **Print:** always light (`@media print { :root { color-scheme: light } }`).

**Typography** (DESIGN §2): Inter with `cv11` and `tnum` for money. Montserrat only for `text-title-lg` (28/34, 700, -0.02em) and `text-hero` (32/38, tabular), because it is about 11% wider and caused truncation. Other roles: `text-row` 15/20 500 and `text-caption` 13/18. Uppercase tracked labels are banned.

**Component utilities** (`@utility` in app.css): `btn`, `btn-primary`, `btn-ghost`, `btn-outline` (min-h-11, `press`), `field`, `label`, `card`, `chip` (32px visual with a 44px `::before` hit area; selected via `aria-pressed`, `aria-checked` or `data-active`), `amount`, `page`, `page-grid` (main plus a 22rem side column at 1024px and up), `card-grid` (`repeat(auto-fill, minmax(min(100%,18rem),1fr))`), `bleed`, `bleed-pad`, `list-plain`.

**Global base:** `input, select, textarea { font-size: 16px }` stops iOS zoom. `svg.lucide { flex-shrink: 0 }`. `touch-action: manipulation` on tappables. `-webkit-tap-highlight-color: transparent`.

## 3. Responsive shell
**Breakpoints:** 640px (`sm`, sheet becomes popover, list bleed stops, DataTable switches from cards to grid), 600px (gutter 24), 1024px (`lg`, sidebar replaces tab bar and FAB).

| Width | Navigation | Notes |
|---|---|---|
| < 640 phone | Fixed bottom `TabBar` (4 tabs) plus FAB | Lists bleed edge to edge, sheets are bottom sheets |
| 640 to 1023 tablet | The same TabBar; on `data-platform=desktop` it becomes a floating centered 26rem capsule | Content column is 720px centered, popovers instead of sheets |
| ≥ 1024 desktop | Sticky `Sidebar` (w-64), TabBar and FAB hidden | The New button lives in the sidebar, page enter is a fade only |

**Root layout** (`src/routes/+layout.svelte`):
- `<div class="min-h-svh lg:flex">` contains `<Sidebar/>` and `<main data-scroll-viewport class="min-w-0 flex-1 overflow-x-clip">`, which wraps the keyed `.page-view` wrapper with `data-nav`.
- **The document scrolls, never an inner container.** Safari only gives URL-bar collapse, status-bar tap-to-top and rubber-band to the document scroller. `overflow-x: clip` (not `hidden`) hides slide-ins without breaking `position: sticky`.
- **Page column** (`.page-view`): `--gutter` is 1rem, 1.5rem at 600px and up, 2rem at 1024px and up. `--col` is 720px, or 1100px for `WIDE_ROUTES` (`src/lib/components/layout.ts`). Width is `max-width: calc(var(--col) + 2*var(--gutter)); margin-inline: auto`.
  - **Pages never set their own `max-w`, `mx-auto` or gutters** (WAVE2 "Page width rule"). The audit check `layout-shift-x` verifies that the h1 left edge is identical across pages.
- **Bottom clearance:** the layout sets `--bottom-space` (the tab bar height, or `max(env(safe-area-inset-bottom),8px)` on non-tab pages) and `--fab-space`. The page gets `padding-bottom: calc(var(--bottom-space) + var(--fab-space) + 1.5rem)`.
  - `--tabbar-space` is `4rem + env(safe-area-inset-bottom)`. On iOS it is `4rem + max(env(safe-area-inset-bottom), .75rem) + .5rem`, because the bar floats.
- **Safe areas:** `viewport-fit=cover` in app.html. `main` pads `env(safe-area-inset-left/right)`. The sticky PageHeader pads `env(safe-area-inset-top)`. The TabBar pads the bottom. Sheets use `max-height: calc(100dvh - env(safe-area-inset-top) - 1.5rem)`. The FAB uses `right: max(1rem, env(safe-area-inset-right))`. The admin drawer pads top and bottom.
- **Avoiding scroll gutters and overflow** (app.css plus UI-QA rules):
  ```css
  *, html { scrollbar-width: none; scrollbar-gutter: auto; }
  *::-webkit-scrollbar { display: none; }
  ```
  - Scrollbars are hidden everywhere, so long and short pages never shift sideways. Don't re-add `scrollbar-gutter` or `overflow-y: scroll`.
  - Use `min-w-0` plus `truncate` on text and `shrink-0` on icons. Buttons always get `whitespace-nowrap`; if a label doesn't fit, change the layout.
  - Bleeds are phone-only, through the `bleed`, `bleed-pad` and `list-plain` utilities. Raw `-mx-4` is never used.
  - Native date inputs are reset in CSS (iOS draws them wider than 100%), and the app prefers a custom `DatePicker`.
  - Chip scrollers use `mask-image` fades at the edges.
- **Fixed chrome rule:** a `transform`, `filter` or `will-change` on an ancestor of a `position: fixed` bar re-parents the bar, which makes it jump.
  - So TabBar, FAB, Toaster and sheets are siblings of `.page-view`.
  - Any fixed element inside a page uses `{@attach portal}` or `portalWhen('(max-width: 1023.98px)')` from `src/lib/components/portal.ts`.
  - The layout also drops `data-nav` on `animationend`, so the wrapper keeps no lingering transform.
- **Keyboard and FAB:** `visualViewport` resize detects the keyboard (`innerHeight - vv.height*vv.scale > 150`) and hides the FAB.
- **FAB** (`+layout.svelte`):
  - Extended "+ New" on Android and web, collapsing to the icon while scrolling down (150 ms max-width transition). A round 56px button on iOS.
  - Long-press (450 ms) goes straight to New invoice. A tap opens the `ActionSheet` create menu.
  - From 640px up it sits at `right: max(1.5rem, calc(50% - 360px + 1rem))`, inside the column. It is hidden at 1024px and up. There is never a centered "+" tab.

**TabBar** (`src/lib/components/TabBar.svelte`):
- Fixed, `grid-template-columns: repeat(4,1fr)`, height 4rem, translucent `color-mix(surface 94%)` with `backdrop-filter: blur(20px) saturate(1.6)`.
- Material-style pill behind the icon. It slides with `transform: translateX(active*100%)` over 300 ms snappy; no measuring is needed because the tabs are equal-width.
- On iOS it becomes a floating glass capsule (left and right 1rem, `border-radius: 999px`) with the pill wrapping the whole item.
- Active icon stroke is 2.4 (inactive 1.8). `haptic()` fires on tab change.

**Sidebar** (`src/lib/components/Sidebar.svelte`): `sticky top-0 h-svh w-64 hidden lg:flex`. It holds the brand, a full-width primary "New" button, the primary nav and a "More" nav group under a border, with `SyncStatus` at the bottom.
- The active item uses `bg-primary-soft text-primary`, chosen by section prefix, so `/customers/42` highlights Customers.

**Admin shell** (`src/routes/admin/+layout.svelte`): a separate full-width chrome.
- **Sidebar:** sticky, collapsible from w-60 to 68px icon rail, persisted in localStorage `admin-sidebar-collapsed`. Sections have small muted labels, items are filtered by permission, and badge counts show in destructive text (a dot in rail mode).
- **Phone and tablet:** the same nav renders as a left drawer (`fly x:-300 220ms`, portaled, `w-[min(300px,86vw)]`).
- **Top bar:** sticky h-14. It holds a hamburger (below lg), breadcrumbs, a ⌘K search button (`md:w-64` with "Search or jump to…" and a kbd hint), a theme cycle button and an avatar menu (`Dropdown`).

## 4. Navigation
**Route tree** (`src/routes`):
- **Tab roots:** `/` (invoices home), `/customers`, `/reports`, `/settings` (`TAB_ROOTS` in `motion.ts`).
- **List roots without a tab:** `/quotes`, `/payments`, `/items` (reached from the sidebar's More group and from settings).
- **Details and forms:** `/invoices/new`, `/invoices/[id]`, `/invoices/[id]/edit`, `/customers/new`, `/customers/[key]`, `/customers/[key]/edit`, `/quotes/...`, `/payments/new`, `/payments/[id]`, `/reports/gst`.
- **Settings children:** `/settings/billing`, `/settings/team`, `/settings/data`.
- **Bare pages:** `/welcome` (onboarding), `/account` (sign-in), `/legal/*`.
- **Admin:** `/admin`, plus `orgs`, `orgs/[id]`, `users`, `users/[id]`, `subscriptions`, `payments`, `plans`, `flags`, `webhooks`, `audit`, `staff`.
- **API:** thin `+server.ts` endpoints under `/api/*`, and a generic `/api/admin/[entity]/...` with `bulk` and `export.csv`.

**PageHeader** (`src/lib/components/PageHeader.svelte`), the app's only page header. Props: `title`, `back?`, `backLabel?`, `subtitle?`, `actions?` snippet.
- **Phone and tablet:** a sticky 48px bar (back chevron, compact title, actions) above a large Montserrat title.
  - An `IntersectionObserver` with `rootMargin: -barHeight` switches the bar to `compact` when the large title scrolls under it, iOS-style. The compact title fades in and the bar gets a blurred background (80%) and a hairline.
  - The title is centered on iOS.
- **Desktop (≥1024):** the wrapper becomes a grid with no sticky bar.
  - Back is a small text link *above* the title ("‹ Customers", from a `SECTIONS` map), so the h1 stays on the column edge. Actions sit right-aligned.
- It publishes `--header-h` on `:root` via a ResizeObserver (0 on desktop), so in-page sticky chip bars and day headers stick just under it: `top: var(--header-h, calc(3rem + env(safe-area-inset-top)))`.
- Titles longer than 22 characters step down to 22px and clamp to 2 lines with a `title` tooltip. It also sets `<svelte:head><title>`.

**Smart back** (`src/lib/components/history.ts`):
- `trackNavigation()` in the root `afterNavigate` counts in-app depth. It uses `navigation.currentEntry.index` when the Navigation API exists.
- `goBack(e, fallback)`: `history.back()` if there is in-app history, else `goto(fallback, {replaceState:true})`. Modifier clicks still open a new tab.
- Back links keep a real `href` plus a `data-back` attribute, which makes the transition play as "back".
- Rule: **every non-tab page has a back button** (`scripts/back-flow.mjs` enforces it).

**Breadcrumbs:** admin only.
- `navFor(path)` in `features/admin/components/nav.ts` finds the longest matching nav item.
- Detail pages set `admin.crumb` (shared state) for the record name.
- On phones only the last crumb shows, truncated.

**⌘K palette:** `features/admin/components/Palette.svelte` offers go-to-page, record search (`/api/admin/search`), recent items (`pushRecent`) and actions. `/` opens it, except on table pages, where `/` focuses the table search.

## 5. Management UX for growing data
**Two strategies, split by audience.**

**A. App lists (end users, client-side Dexie data)** in `src/routes/+page.svelte` (home) and `src/routes/customers/+page.svelte`:
- **Plain edge-to-edge rows, never cards** (DESIGN §5).
  - Rows are 64px: 40px initials avatar, `min-w-0 flex-1` text column, right-aligned `shrink-0` amount over a status dot and word.
  - The hairline separator is inset 68px. Press feedback is a `muted` background with no scale.
- **Grouping:** by day, with sticky day headers that carry the day total (`Today · ₹18,400`). The pattern is one `$derived.by` pass over the sorted list.
- **Search:** a 36px muted-fill search field under the title that scrolls away. Smart parsing (`features/smart/search.ts`) handles `overdue ravi >5k this week` and shows chips for what it understood. `?q=` deep-links into the search.
- **Filters:** a sticky horizontal chip bar (All · Unpaid · Overdue · Paid · Drafts), `top: var(--stick)`, with a `mask-image` edge fade. Tapping a stat in the summary line applies its filter.
- **Sort:** a simple toggle (`'collect' | 'az'`) on customers. The default "chase" ranking puts the most-overdue customers first.
- **No pagination:** the data is local and reactive (Dexie live queries).
- **Empty and loading states:** skeleton rows sized like real rows (`h-16 animate-pulse`). A "no match" state offers a *Clear filters* button. The first-run `EmptyState` has a 48px icon, one line and one primary button.
- **Row accelerators:** trailing swipe (Mark paid, Remind) and long-press or right-click to open a `Sheet` action menu. Every gesture also has a visible tap path.

**B. Admin tables (server data that grows without bound):** `src/lib/components/datatable/DataTable.svelte` (1.8k lines, generic `DataTable<Row>`).
- **Server-driven:** `fetchPage(query, signal) → ListResult<Row> = {rows, nextCursor, total, totalExact, facets}`.
  - The query schema (`features/admin/schema.ts`) is `{q, sort, dir, filters: Record<string,string|string[]>, cursor, limit≤200 (default 50)}`. It round-trips through the URL (`listQueryToParams` / `listQueryFromUrl`, facet params as `f.<id>=v`).
- **Keyset pagination only. OFFSET is never used.** The opaque cursor is built over `(sortValue, id)`.
  - Paging is a "Load more" button plus infinite scroll (an IntersectionObserver sentinel with `rootMargin: 0 0 800px 0`).
  - Rows are virtualized beyond 200 (`VIRTUALIZE_AFTER`), using the window scroll with fixed row heights (comfortable 44, compact 32, phone card 68).
  - The total is exact for small sets and estimated from pg stats above 10k.
- **Search:** debounced, synced to the URL. Server side it uses `pg_trgm` GIN indexes. `/` focuses the search.
- **Filters:**
  - Desktop has one `FacetMenu` popover per facet, with counts.
  - Phone has a single "Filters" button with a count badge that opens a Sheet.
  - Active filter pills each have an × button, plus "Clear all".
- **Views:** `ViewsMenu` stores saved views (query plus column state) per `tableId` in localStorage, with a default view.
- **Columns:** `ColumnsMenu` controls visibility, order and resize, all persisted. The header is sticky (`--dt-sticky-top`) and the first column is sticky on horizontal scroll. A right-edge shadow shows when more columns are off to the right. A density toggle switches between comfortable and compact.
- **Selection and bulk:**
  - Checkboxes, page selection, and "Select all N matching", which sends `{query}` instead of ids. The bulk bar is sticky at the bottom.
  - Destructive bulk actions open a typed-confirm sheet (`typeToConfirm: 'SUSPEND'`).
  - Results arrive as a toast with Undo where safe.
- **Export:** `exportHref(query)` points at an `export.csv` stream (BOM, CRLF, formula-escaped).
- **Keyboard:** j/k or ↑/↓, Enter to open, x to select, Esc. Rows are focusable with `role=row` and `aria-selected`.
- **Phone (<640):** the *same column defs* render cards. Each `ColumnDef` has `mobile: 'title'|'subtitle'|'meta'|'trailing'|'hidden'`; when unset, the first column is the title, the first right-aligned column is trailing and the second column is the subtitle.
  - There is no horizontal grid on phones, and a "Select" button enters selection mode.
- **States:** skeleton rows at real row height, with static bars and no shimmer. An empty state offers Clear filters. An error state offers Retry.
- **Row detail:** `datatable/Drawer.svelte`, a right panel about 480px wide on desktop and a full-height bottom sheet on phones. ←/→ steps between rows, and it has an "Open full page" action.
- **Usage example:** `src/routes/admin/users/+page.svelte`, where columns are declared with `mobile` roles and `bulkActions` carry confirm config.
- `src/routes/_datatable-demo/` has fake data for testing at scale.

**Desktop vs phone summary**
- Search: always visible on both.
- Filters: popovers on desktop, one Filters sheet on phones.
- Columns and density: desktop only.
- Rows: a grid on desktop, cards from the same column defs on phones.
- Detail: a side drawer on desktop, a bottom sheet on phones.
- Pickers: an anchored popover on desktop, a bottom sheet on phones (`Dropdown.svelte`).

## 6. Widgets, dashboard cards and charts
- **KPI tiles** (`features/admin/components/Kpi.svelte`): label, value (22px semibold, truncated with a `title`), and a delta vs the previous period (an arrow, a signed %, and color from `direction × upIsGood`). A 96×28 sparkline is drawn in the muted hue with the current point in the accent.
  - Layout trick in `routes/admin/+page.svelte`: `grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 xl:grid-cols-5`. The 1px gap shows the border color, so the tiles get hairline dividers without extra borders.
- **Chart** (`features/admin/components/Chart.svelte`): a hand-rolled SVG with one series as a line (2px stroke with a 10% wash) or bars (≤24px wide, 4px rounded tops).
  - Ticks use a clean 1/2/2.5/5×10ⁿ step with 4 lines and a hairline grid.
  - It has an end-value direct label, a crosshair tooltip, ←/→ keyboard navigation and a screen-reader table toggle.
  - Colors come from two validated slots, `--s1 #2a78d6` and `--s2 #eb6834`, with separate dark steps (`#3987e5`, `#d95926`).
  - Rule: two measures never share an axis; use two charts.
- **SalesChart** (`features/reports/components/SalesChart.svelte`): the same approach for the reports tab. `AgingBar.svelte`, `PeriodBar.svelte` and `Section.svelte` are other report widgets.
- **Admin overview layout:** KPI wall, then `grid gap-4 xl:grid-cols-[3fr_2fr]` with two charts, then a "Needs attention" queue (failed payments, halted subs, webhook errors) in `md:grid-cols-2`.
- **App home has no KPI wall** (DESIGN §8 anti-pattern). It shows one hero number ("To collect"), one stat line, and a single "next best action" card (`features/smart/insights.ts`).
- **Status** (`features/admin/components/Status.svelte`): a 6px dot plus a word. Only trouble states (failed, past_due, suspended, overdue) color the word. No filled pills.
- **Skeleton** (`features/admin/components/Skeleton.svelte`) and **Switch** (`features/admin/components/Switch.svelte`): small helpers.

## 7. Motion
**Tokens** (`app.css`):
```css
@theme static {
	--ease-snappy: cubic-bezier(0.22, 1, 0.36, 1);
	--ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);
	--ease-bounce: cubic-bezier(0.34, 1.45, 0.64, 1);
	--ease-interactive: cubic-bezier(0.175, 0.885, 0.32, 1.08);
	--ease-material: cubic-bezier(0.2, 0, 0, 1);
	--ease-sheet: cubic-bezier(0.2, 0.8, 0.2, 1);
}
:root { --dur-fast: 0.22s; --dur-normal: 0.38s; --dur-slow: 0.55s; }
```
**Page transitions:** only the incoming page animates, with `animation-fill-mode: backwards`, so no transform lingers.
- `motion.ts` `navDirection(from, to, {pop, back})` returns `forward`, `back`, `tab-left` or `tab-right`. Tab-to-tab direction comes from the `TAB_ROOTS` index.
- If Safari's own swipe-back already animated (`hasUAVisualTransition`), the app skips its transition.

| Direction | Default (web) | Android (`data-platform=android`) | iOS | ≥1024 desktop |
|---|---|---|---|---|
| forward | `push-in` translateX 18%, 220ms snappy | `md-fade-through` scale .96 plus fade, 220ms material | `ios-push-in` from 100% with brightness, 260ms | `md-fade` 6px plus fade, 200ms |
| back | `pop-in` -12%, 220ms | `md-fade-back` scale 1.03 | `ios-pop-in` -28%, 240ms | same |
| tab | ±5%, 220ms | `md-fade` 200ms | `ios-tab-in` scale .985, 220ms smooth | same |

**Other motion**
- **Press:** `press` utility, `:active` scale .98 with brightness .94; iOS uses scale .96 with brightness .97.
- **List enter:** `rise` utility, 450ms snappy with a 40ms stagger via `style="--i: n"`, capped at 240ms. iOS uses `rise-spring` (520ms bounce).
- **Sheets:** in at 280ms quartOut (DESIGN §7 uses `cubic-bezier(.2,.8,.2,1)`). Out at 240ms, continuing from the drag position. At 640px and up the sheet is a centered dialog: in 240ms (opacity plus 12px plus scale .96), out 160ms.
  - Drag or flick to dismiss: past `min(110px, 30%)` or velocity above 0.55. Otherwise it settles back with a 320ms snappy transition.
- **Other durations:** tab pill 300ms snappy; FAB collapse 150ms; theme crossfade 200ms; admin drawer `fly` 220ms.
- **Haptics:** `haptic(ms=10)` calls `navigator.vibrate`, which only works on Android. It is skipped under reduced motion.
- **Never animate:** money count-up, parallax, confetti, shimmer longer than 300ms, bouncing badges (DESIGN §7).
- **Reduced motion:** a global rule sets every animation and transition to 0.01ms. JS checks `reducedMotion()` to make transitions duration 0. `prefers-reduced-transparency` removes the backdrop-filter.

## 8. Native mobile (PWA, TWA, iOS)
**There is no Capacitor.** Native distribution is "thin shell around the live URL":
- **PWA:** `static/manifest.webmanifest` (`display: standalone`, theme `#671FAF`, maskable 512 icon, a "New invoice" shortcut).
  - app.html sets `apple-mobile-web-app-capable`, `status-bar-style: black-translucent`, `format-detection telephone=no`, `<meta name="text-scale" content="scale">`, and two `theme-color` metas.
- **Service worker** (`src/service-worker.ts`):
  - Precaches the shell plus immutable assets under a versioned cache. Every navigation is served from the cached `/` shell, so the app works offline.
  - `/api`, `/admin`, `.csv` and `/healthz` always go to the network.
  - The new worker *waits*. `src/lib/components/update.ts` and `UpdatePrompt.svelte` apply a server-controlled policy: auto (switches at a safe moment), prompt (banner), or force (saves drafts through `markDirty`/`takeDraft`, then reloads). It is configured in Admin › Feature flags.
- **Install:** `src/lib/components/install.svelte.ts` captures `beforeinstallprompt` and exposes `canInstall` and `installApp()`.
- **Android:** a Trusted Web Activity built with Bubblewrap (`android/twa-manifest.json`, package `com.divyanshshukla.easybusiness`).
  - It sets `themeColorDark`, `navigationColor` and its dark variant, `orientation: portrait`, and `fallbackType: customtabs`.
  - `static/.well-known/assetlinks.json` holds the signing fingerprint.
  - Built with `scripts/build-android.sh` (gradle, zipalign, apksigner). The keystore lives outside the repo in `~/.android-keystores/`. Bump `appVersionCode` only for store uploads; web deploys update the app on their own.
- **iOS:** the README plans a WKWebView shell (PWABuilder or Capacitor loading the live URL). It warns that Apple guideline 4.2 needs native-feeling navigation, offline support and share/print plugins.
- **Billing inside the TWA:** `isAndroidApp()` detects the `android-app://` referrer. Purchases are hidden unless `BILLING_IN_ANDROID_APP=true` (Play policy).
- **Sign-in:** a server-side OAuth redirect flow with no popup, so it works in the iOS standalone PWA and in the TWA.
- **iOS-specific CSS:**
  - 16px inputs.
  - Native date inputs reset (or replaced by `DatePicker`).
  - `-webkit-touch-callout: none` on tappables.
  - The document is the scroller.
  - The floating capsule tab bar.
  - `100svh` / `100dvh` usage.
  - Body scroll is locked while a sheet is open (`documentElement.style.overflow='hidden'`).

## 9. Reusable components worth copying
Paths are under `src/lib/components/` unless noted.

| Component | Purpose |
|---|---|
| `src/app.css` | The whole token, utility and motion system in one file. Copy the structure wholesale. |
| `src/app.html` | Pre-paint platform, theme and accent script; two theme-color metas. |
| `theme.svelte.ts` | Mode and accent store, crossfade, meta sync. |
| `motion.ts` | `platform()`, `reducedMotion()`, `haptic()`, `TAB_ROOTS`, `navDirection()`. |
| `history.ts` | Smart back (`trackNavigation`, `canGoBack`, `goBack`). |
| `portal.ts` | `portal` and `portalWhen(query)` attachments for fixed elements. |
| `layout.ts` | `WIDE_ROUTES` and `isWide()` for the column width. |
| `PageHeader.svelte` | Large-to-compact title, back button, actions, `--header-h`, desktop variant. |
| `TabBar.svelte` / `Sidebar.svelte` | Phone tabs with a sliding pill and iOS capsule; desktop rail. |
| `Sheet.svelte` | Bottom sheet on phones, dialog at 640px and up. Drag to dismiss, focus trap, scroll lock, footer slot. |
| `Dropdown.svelte` | Sheet on phones, anchored flip-aware popover at 640px and up. The base for pickers and menus. |
| `Picker.svelte` | Replaces `<select>`. Variants field, value, inline and chip; automatic search above 8 options; listbox keyboard and ARIA. |
| `DatePicker.svelte` + `calendar.ts` | Replaces `<input type=date>`. Quick chips, Monday-first grid, 44px days, timezone-safe ISO math. |
| `ActionSheet.svelte` | Create menu (icon tile, label, hint; primary and destructive tones). |
| `Toaster.svelte` + `toast.svelte.ts` | One toast at a time, an optional action (Undo), placed above `[data-bottom-bar]`, the FAB and the tab bar. |
| `EmptyState.svelte` | Icon, title, body and action, with a staggered `rise`. |
| `UpdatePrompt.svelte` + `update.ts` + `update-policy.ts` | SW update policy (auto, prompt, force) with draft rescue. |
| `install.svelte.ts` | PWA install prompt capture. |
| `SyncStatus.svelte` | Sidebar footer sync indicator. |
| `datatable/*` | `DataTable`, `Drawer`, `FacetMenu`, `ViewsMenu`, `ColumnsMenu`, `Box`, `state.ts` (pure reducers, tested), `ui.ts` (shared class strings). |
| `features/admin/components/*` | `Kpi`, `Chart`, `Status`, `ConfirmSheet` (typed confirm), `Palette` (⌘K), `PageTitle`, `Skeleton`, `Switch`, `Diff` (audit before/after), `nav.ts` (permission-filtered nav sections). |
| `src/routes/admin/+layout.svelte` | Collapsible admin sidebar, drawer, breadcrumbs, ⌘K, theme toggle. |
| `src/lib/initials.ts` | Initials avatar plus `nameHue()` hash to 8 muted hues. |
| `scripts/ui-audit.mjs`, `nav-jump.mjs`, `back-flow.mjs` | Playwright QA gates (see §10). Very worth porting. |

## 10. Rules from the docs (condensed)
There is no CLAUDE.md. The rules come from DESIGN.md, UI-QA.md, WAVE2.md, ADMIN.md and ARCHITECTURE.md.

**Content and visual**
1. One hero number per screen and one number per row. Money is right-aligned, uses `tabular-nums` and lakh/crore grouping, never shows `₹0.00` (use `—`), and drops `.00` in lists.
2. Status is text, not paint: a 6px dot and a word. Only overdue or trouble states get color. No filled pills.
3. Accent appears at most once per screen. `primary-soft` is only for the selected chip or nav item.
4. Progressive disclosure: optional fields stay collapsed. Use a single scrolling form, never a wizard.
5. Thumb zone: primary actions sit in the bottom third. Every gesture has a visible tap twin.
6. Touch targets are at least 44px; chips are 32px visually with a 44px hit area.
7. Radius scale: 6 badge, 10 input or button, 12 card or group, 16 sheet, full for chips and avatars, 0 for list rows.
8. Gutters are 16, 24 and 32. Lists are capped at 720px; wide routes at 1100px. The layout owns the column; pages never set `max-w` or gutters.
9. Main lists are plain and edge to edge. Settings and forms use inset-grouped sections.
10. Anti-patterns: KPI card walls in the app, tinted stat tiles, card-per-row, uppercase tracked labels, Montserrat body text, lavender dark fills, a FAB covering the last row or shown alongside a bottom bar.
11. Pickers are never native (`Picker` and `DatePicker`). Never call `new Date('YYYY-MM-DD')`.
12. Icons always get `shrink-0`; text gets `min-w-0 truncate`; buttons get `whitespace-nowrap`.

**Layout and behaviour**
13. The document scrolls. There is no transform, filter or will-change on ancestors of fixed bars, and fixed elements in pages are portaled. A submit button inside a portaled bar needs `form="id"`.
14. Scrollbars are hidden globally with no gutter.
15. Smart back: every non-tab page has a back button that uses `goBack()`.
16. One toast at a time, with a fixed height, above `[data-bottom-bar]`.
17. Destructive admin actions use typed-confirm sheets, never `window.confirm`. Use optimistic updates with Undo where safe. Every action toasts and is audited.
18. Lists use keyset pagination only, with the URL as the state.

**Architecture**
19. Tokens live only in `app.css`; there are no raw colors in components.
20. Services own data access: routes and components never import the DB or ORM.
21. Money is stored as integer minor units.
22. Offline first.

**QA gate**
23. `svelte-check` is clean, `bun test` passes, and `bun run build` succeeds.
24. `ui:audit` shows 0 serious issues. It covers 10 viewports from 320 to 1440, including iPhone WebKit, in light and dark. Checks: h-overflow, icon-squish, icon-jump, covered, wrapped-label, tap-target, clipped-text, axe, js-error, layout-shift-x, edge-misalign.
25. `ui:nav` passes: bottom bars never move during a transition.
26. `ui:back` passes.
27. Screenshots are reviewed at Pixel 7 light, iPhone 15 dark, 320 and 1440.

## Takeaways for UCI
- Copy `app.css` structure as-is: OKLCH `light-dark()` tokens, the `--hue` accent, `data-theme`/`data-accent`/`data-platform` on `<html>` set pre-paint, and motion tokens.
- Use the same shell: document scroll, a layout-owned column, TabBar below 1024, Sidebar at 1024 and up, portaled fixed chrome, PageHeader with smart back.
- **Student app:** plain grouped lists (by day or batch) with chip filters and search; data is small.
- **Institute admin:** port DataTable (keyset, URL state, facets, mobile cards from column defs, Drawer) for students, tests and results.
- Port the three Playwright QA scripts early; they are what keeps the design from regressing.
- Native: if UCI picks Capacitor, keep the "thin shell around the live URL" principle and the SW update policy. Easy-business itself ships only a PWA and an Android TWA.
