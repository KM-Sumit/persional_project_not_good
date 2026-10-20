# Research: campusquiz-svelte (gold-standard reference)

Source: `/Users/divyansh/Desktop/code/campusquiz-svelte` (read 2026-10-20). All paths below are relative to that repo unless absolute.
It is itself modelled on `/Users/divyansh/Desktop/code/abizer-sir/easy-business` (shell, PWA, platform CSS, admin tabs), so that repo is the upstream for the same patterns.

---

## 1. Stack + dependencies (`package.json`)

- Bun everywhere (`bun --bun vite dev`, `bun test`, `bun server.js`). adapter-node, with a custom `server.js` entry.
- SvelteKit **3** with Svelte 5 runes forced on for all non-node_modules files. There is **no `svelte.config.js`**: the kit config (adapter, csp, paths) lives inside `sveltekit({...})` in `vite.config.ts`.
- Subpath imports: `"#lib": "./src/lib/index.js"`, `"#lib/*": "./src/lib/*"`. Code uses `#lib/...` and not `$lib`.

| dependencies | version | devDependencies | version |
|---|---|---|---|
| @lucide/svelte | ^1.55.0 | @sveltejs/kit | ^3.0.0 |
| drizzle-orm | ^0.45.4 | @sveltejs/adapter-node | ^6.0.0 |
| postgres (postgres-js) | ^3.4.9 | @sveltejs/vite-plugin-svelte | ^7.2.0 |
| zod | ^4.6.6 | svelte | ^5.57.1 |
| jose (JWT + Google id_token) | ^6.2.12 | svelte-check | ^4.6.0 |
| katex | 0.16.11 | tailwindcss / @tailwindcss/vite | ^4.3.3 |
| unpdf (PDF text layer) | 1.8.1 | vite | ^8.3.0 |
| heic-decode / jpeg-js | 2.1.0 / 0.4.4 | typescript | ^6.0.3 |
| nodemailer | ^10.1.0 | drizzle-kit | ^0.31.11 |
| | | @types/bun, @types/nodemailer | |

There is **no LangChain, no AI SDK and no Gemini**. AI is a plain `fetch` to OpenRouter (see §7).

Scripts: `dev`, `build`, `check` (svelte-kit sync + svelte-check), `start` (`bun server.js`), `test` (`bun test`), `db:up` (docker compose `compose.local.yaml`: Postgres :5434, Valkey :6381), `db:generate|migrate|push`, `db:seed`, `db:seed:demo`.

Infra pieces:
- `src/lib/server/env.ts`: a Zod schema over `process.env`, parsed lazily (`env()`), so `vite build` works without env. Empty strings count as unset. ORIGIN is required in production.
- `src/lib/server/cache/{lru,redis,index}.ts`: a two-tier `cached(key, ttl, loader)` (L1 in-process LRU of 5000 entries, then L2 Redis, then the loader). `invalidate()` uses pub/sub to clear every instance's L1. Every Redis call is best-effort (`tryRedis` returns null when Redis is down).
- `src/lib/server/rate-limit.ts`: a fixed-window `hit(key, limit, windowSec)` that uses Redis INCR and falls back to the LRU. It never throws. It is called from `hooks.server.ts` as `allowRequest(event)`.
- Drizzle is imported only in `src/lib/server/services/*.ts`. Routes call services.
- `server.js`: adds `Cache-Control: no-cache, no-store` + `CDN-Cache-Control: no-store` for `/service-worker.js`, `/manifest.webmanifest` and `/_app/version.json`, so updates are never stuck behind Cloudflare. It exits at boot when ORIGIN is unset in production.
- `vite.config.ts`: `paths: { relative: false }` (absolute asset paths, so the SW's cached offline page works on nested routes). It sets a CSP in `mode: 'auto'` as `reportOnly`, with `report-uri: /api/csp-report`, which is required or every page 500s. `server.watch.ignored: ['**/e2e/**']`.

---

## 2. Design system (`src/app.css`, a single token file of about 1300 lines)

Direction: **"answer sheet"**. Light mode looks like exam paper; dark mode is a calm blue-slate.

### Fonts (Google Fonts `<link>` in `src/app.html`, preconnected)
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
```
- Display (h1–h3, `.font-display`, `.brand`, `.page-title`, stat values): **Bricolage Grotesque** 600/700/800, with `letter-spacing: -0.02em` (titles go to -0.03em).
- Body: **IBM Plex Sans** 400–700, `font-feature-settings: "ss01"`.
- Mono (codes, timer, OMR bubble letters, question-grid numbers): **IBM Plex Mono** 400–600.
- The service worker caches the font CSS and files cache-first in a `fonts` cache that survives builds.

### Tailwind v4 bridge
```css
@import 'tailwindcss';
@source not '../e2e';
@custom-variant dark (&:where(.dark, .dark *));
@theme inline {
  --font-sans: var(--font-body); --font-display: var(--font-display); --font-mono: var(--font-mono);
  --color-border: hsl(var(--border)); --color-input: hsl(var(--input)); --color-ring: hsl(var(--ring));
  --color-background: hsl(var(--background)); --color-surface: hsl(var(--surface)); --color-foreground: hsl(var(--foreground));
  --color-success: hsl(var(--success)); --color-warning: hsl(var(--warning)); --color-danger: hsl(var(--danger));
  --color-primary: hsl(var(--primary)); --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary)); --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted)); --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent)); --color-accent-foreground: hsl(var(--accent-foreground));
  --radius-lg: var(--radius); --radius-md: 10px; --radius-sm: 8px;
}
```
Tokens are bare HSL triplets, so `hsl(var(--primary) / .12)` and Tailwind's `bg-primary/10` both work.

### Token block (verbatim)
```css
:root {
    --background: 220 14% 96%;        /* paper */
    --surface: 0 0% 100%;             /* card */
    --foreground: 218 46% 10%;        /* ink */
    --primary: 227 100% 58%;          /* pencil blue */
    --primary-foreground: 0 0% 100%;
    --secondary: 220 16% 93%;
    --secondary-foreground: 218 46% 10%;
    --muted: 220 16% 93%;
    --muted-foreground: 218 12% 42%;
    --accent: 220 16% 93%;
    --accent-foreground: 218 46% 10%;
    --border: 220 17% 89%;
    --input: 220 17% 86%;
    --ring: 227 100% 58%;
    /* Dark enough for 4.5:1 as text on white, on tinted badges and as a fill under white text. */
    --success: 153 72% 25%;
    --warning: 30 95% 31%;
    --danger: 356 70% 45%;
    --radius: 14px;

    --font-display: "Bricolage Grotesque", "IBM Plex Sans", system-ui, sans-serif;
    --font-body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;

    --appbar-h: 56px;
    --tabbar-h: 64px;
    --sidebar-w: 15.5rem;
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --tabbar-space: calc(var(--tabbar-h) + var(--safe-bottom));

    /* Fluid scale: grows smoothly from 360px phones to 1440px desktops. */
    --gutter: clamp(1rem, .55rem + 2vw, 2rem);
    --space-section: clamp(1.25rem, 1rem + 1.2vw, 2.25rem);
    --text-title: clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem);
    --text-section: clamp(1.0625rem, 1rem + .3vw, 1.25rem);

    /* Motion */
    --ease-snappy: cubic-bezier(.22, 1, .36, 1);
    --ease-smooth: cubic-bezier(.25, .1, .25, 1);
    --ease-spring: cubic-bezier(.34, 1.45, .64, 1);
    --ease-ios: cubic-bezier(.32, .72, 0, 1);
    --ease-material: cubic-bezier(.2, 0, 0, 1);
    --dur-fast: .22s;
    --dur-normal: .38s;
    --shadow-sm: 0 1px 2px hsl(218 46% 10% / .06);
    --shadow-lg: 0 12px 32px -8px hsl(218 46% 10% / .22), 0 2px 6px hsl(218 46% 10% / .08);
    color-scheme: light;
}

.dark {
    --background: 222 24% 8%;
    --surface: 222 20% 11.5%;
    --foreground: 220 20% 94%;
    --primary: 227 100% 74%;
    --primary-foreground: 222 30% 8%;
    --secondary: 222 16% 16%;
    --secondary-foreground: 220 20% 94%;
    --muted: 222 16% 16%;
    --muted-foreground: 220 10% 66%;
    --accent: 222 16% 16%;
    --accent-foreground: 220 20% 94%;
    --border: 222 14% 21%;
    --input: 222 13% 27%;
    --ring: 227 100% 74%;
    --success: 152 58% 55%;
    --warning: 40 92% 62%;
    --danger: 358 85% 70%;
    --shadow-sm: 0 1px 2px hsl(0 0% 0% / .3);
    --shadow-lg: 0 16px 40px -8px hsl(0 0% 0% / .6);
    color-scheme: dark;
}

/* Platform tokens (data-platform is set in app.html before first paint). */
:root[data-platform='ios'] { --radius: 12px; --tabbar-space: calc(56px + 8px + max(var(--safe-bottom), .75rem) + .5rem); }
:root[data-platform='android'] { --radius: 16px; }
@media (min-width: 640px)  { :root[data-platform='desktop'] { --tabbar-space: calc(var(--tabbar-h) + 2rem); } }
@media (min-width: 1024px) { :root, :root[data-platform] { --tabbar-space: var(--safe-bottom); } }
```
Theme-color metas: light `#f4f5f7`, dark `#101219`.

### Accent and semantic colours
- There is one brand accent, **pencil blue** (`--primary`, 227 100% 58%, lightened to 74% in dark mode). There is no secondary brand hue: secondary, muted and accent are all the same neutral grey.
- Success, warning and danger are tuned for 4.5:1 contrast. In dark mode they become light, so `.dark .btn-success` swaps to dark text.
- **Ink** is the second "accent". `.btn-ink`, active chips, the selected OMR bubble, answered grid cells and toasts all use `foreground` as the fill and `background` as the text.
- Score colours: `.score-good|mid|low` map to success, warning and danger.

### Theme switch mechanism
1. An inline `<script nonce="%sveltekit.nonce%">` in `src/app.html` runs **before first paint**. It sets `documentElement.dataset.platform` (ios, android or desktop; iPadOS is detected by `Macintosh` plus `maxTouchPoints > 1`) and toggles `.dark` from `localStorage.theme`, falling back to `prefers-color-scheme`.
2. `src/lib/components/ui/ThemeToggle.svelte` toggles the `.dark` class, writes `localStorage.theme`, and repaints **both** `meta[name=theme-color]` tags so the status bar colour follows a manual choice. It renders both icons (`<Sun class="hidden dark:block"/><Moon class="dark:hidden"/>`) so the SSR output never flashes the wrong icon.
3. There are only two modes, light and dark. A "Device" option was explicitly dropped by the SIMPLICITY RULE. The system preference is used only until the user toggles.
4. `static/offline.html` repeats the same theme script with its own small token set.

### Radius, shadows, spacing, typography
- Radius: `--radius` 14px (12px on iOS, 16px on Android) for cards, lists and stats. Buttons are 12px (`btn-sm` 10px, `btn-lg` 14px; **pill-shaped on Android**). Inputs are 12px, sheets 20px (28px on Android), dialogs 20px (28px on Android), chips and badges 999px.
- Shadows: only `--shadow-sm` and `--shadow-lg`. `btn-primary` adds a tinted glow (`0 1px 2px hsl(var(--primary)/.25), inset 0 1px 0 hsl(0 0% 100%/.12)`), and `a.card:hover` lifts by 1px with a soft shadow.
- Spacing: fluid `--gutter` and `--space-section`, plus utilities `.stack` (1rem), `.stack-sm` (.5rem) and `.stack-lg` (`--space-section`). Page containers: `.page` (72rem), `.page-narrow` (40rem), `.page-form` (30rem). All use `padding: clamp(1rem,.5rem+2vw,2rem) var(--gutter) 0`.
- Type scale:
  - `.page-title`: `--text-title` clamp(1.75→2.5rem), weight 800, -0.03em. iOS uses a large title, clamp(2.125→2.75rem); Android uses 700, clamp(1.75→2.25rem).
  - `.section-title`: `--text-section` 1.0625→1.25rem, weight 700.
  - Body: .9375rem. `.small` .8125rem, `.tiny` .75rem.
  - `.eyebrow`: .6875rem uppercase, .08em tracking.
  - `.stat-value`: clamp(1.5→2.125rem), weight 800, tabular.
  - `.tabular` sets tabular-nums.
- Touch: every control is at least 44px under `(pointer: coarse), (max-width: 767px)`. Inputs are forced to 16px on phones so iOS doesn't zoom.
- Base: `html { overflow-x: clip; scrollbar-gutter: stable; }`, `overscroll-behavior-y: none`, and `html:has(dialog[open]) { overflow-y: hidden }` for the scroll lock.
- All component classes (`.btn`, `.card`, `.list`, `.list-row`, `.stat`, `.badge`, `.segmented`, `.chip`, `.omr`, `.sheet`, `.toast`, `.actionbar`, `.score-ring`, `.progress`, `.skeleton`, `.empty`) sit in `@layer components`, so Tailwind utilities override them.
- Rule (PLAN.md): no raw colours in pages. Use tokens and UI primitives, and keep tokens only in `src/app.css`.

---

## 3. App shell + navigation (`src/routes/+layout.svelte`)

### Breakpoints
| Width | Chrome |
|---|---|
| < 1024px (phones, tablets) | Sticky **app bar** at the top (brand, Install, ThemeToggle, Log in/Sign up) and a fixed **bottom tab bar** |
| 640–1023px with `data-platform=desktop` | The tab bar becomes a floating, centred card (`width:min(32rem,…)`, bottom 1rem, radius 1.25rem) |
| ≥ 1024px | A left **sidebar rail** (`--sidebar-w` 15.5rem, sticky, full height). The app bar and tab bar are hidden. |

### Tab bar (`.tabbar`)
- Tabs have equal width (`grid-template-columns: repeat(var(--tabs), 1fr)`, max-width 36rem). The active **pill** (`.tab-pill`) moves by `translateX(activeIndex*100%)`, so nothing is measured, with `.42s var(--ease-spring)`.
- iOS: a floating glass capsule (inset .75rem, radius 999, blur 24px, 56px tall). The pill wraps the whole item.
- Android: a Material 3 solid bar with no blur. The active label is bold foreground and the icon is primary.
- Default: a translucent `surface/.9` bar with `saturate(1.8) blur(20px)`. The pill is a 56×30 capsule behind the icon.
- Active icon `strokeWidth` is 2.4 versus 1.8. Pressing scales the icon to .86. `haptic()` fires on a tab change.
- Tabs are built per role:
  - teacher: Home, Quizzes, Batches (feature flag), Insights, Me.
  - student: Home, Join, Me.
  - admin: Admin, Me.
- `activeHref` picks the **most specific match** (sorted by href length), so the area Home acts as the catch-all.
- `body.has-tabbar` sets `--bottom-space`. Any page with an `.actionbar` hides the tab bar (`body:has(.actionbar) .tabbar {display:none}`).
- Full-screen routes hide both tabs and sidebar: `/^\/(q|onboarding)(\/|$)|^\/teacher\/quizzes\/(new(\/|$)|[^/]+\/edit(\/|$))/`.

### App bar (`.appbar`)
- Sticky, `background/.82` with blur. `.is-scrolled` (scrollY > 4) adds the hairline.
- **Large-title collapse**: after each navigation an IntersectionObserver watches the page's first `.page-view h1`. Once the h1 scrolls under the bar, the bar swaps the brand for a compact title. On iOS that title is centred in the body font, weight 600. On Android it is 1.25rem, weight 500, and the bar gets a 5% primary tint on scroll.
- iOS and Android app bars differ: iOS uses a .5px shadow line, Android a solid background with an elevation shadow.

### Sidebar (`.sidebar`, ≥1024px)
- Brand, a primary "New quiz" button (teachers), then nav links (44px tall, radius 12px). The active link uses `primary/.1` with primary text. The footer holds Install and ThemeToggle.

### FAB (`src/lib/client/fab.ts`)
- There is one global FAB, set per page with `$effect(() => setFab({label, href|onclick, icon?}))`. It resets on every navigation.
- It is extended with a label on Android and desktop, icon-only and round on iOS.
- The label collapses while scrolling down. The FAB hides when the on-screen keyboard is open (detected with `visualViewport`) and is hidden at ≥1024px.

### Back buttons and "breadcrumbs"
- There are no breadcrumbs. Detail pages have a `.back-link` (`<a class="back-link"><ChevronLeft/> Home</a>`, muted, 40–44px tall).
- Smart back (`src/lib/client/history.ts`): `<a href={parent} data-back onclick={(e) => goBack(e, parent)}>`. It calls `history.back()` when there is in-app history (Navigation API `currentEntry.index`, falling back to a depth counter) and otherwise does `goto(parent, {replaceState:true})`. Modifier clicks are left alone so "open in new tab" still works.
- `data-back` and `.back-link` also force the "back" page animation.
- Admin has its own full-height shell (`src/routes/admin/+layout.svelte`):
  - Grouped nav (`src/lib/components/admin/nav.ts`): Overview · People · Content · Setup · Money.
  - Desktop gets a sidebar. Phones get the current group as segmented tabs (`AdminTabs.svelte`).
  - Detail pages use `?tab=` tabs (`DetailTabs.svelte`) that replace the history entry.
- Submitting a quiz does `goto(result, {replaceState:true})`, so Back can't land on a finished quiz.

### Route tree (`src/routes`)
```
+layout.svelte / +layout.server.ts   (user, siteName (cached 60s), batchesTab flag)
+page (landing; redirects signed-in users to homeFor())   +error.svelte
(auth)/  AuthShell.svelte GoogleButton.svelte InAppBrowser.svelte schemas.ts
  login signup forgot reset/[token] verify verify/[token] account logout(+page.server)
  auth/google (+server: start)  auth/google/callback (+server)  role, pending (redirects)
q/[code]                    quiz landing (start)
q/[code]/attempt            immersive attempt page  (+ attempt/answer/+server.ts autosave POST)
student/  (Home) join analytics history batches attempts/[id] (result + review)
teacher/  (Home) quizzes quizzes/new quizzes/new/[code] (wizard)  quizzes/[id] (detail)
  quizzes/[id]/edit (+ edit/stream NDJSON AI)  quizzes/[id]/live  quizzes/[id]/results (+ export CSV)
  quizzes/[id]/attempts/[attempt]  bank insights billing settings
  batches batches/[id]/{announcements,import,quizzes,results}   new, analytics (+server redirects)
admin/   (own shell) users users/[id] teachers quizzes quizzes/[id] attempts batches teacher-types[/id]
  forms forms/[id] academics setup plans billing features features/[userId]
onboarding/complete  profile  b/[code] (batch join)  join dashboard me (+server redirects)
branding (+server)  branding/logo/[file]  api/csp-report  api/razorpay/webhook  health healthz
accounts/[...rest], attempt/[...rest], teacher/[code=legacycode]/[...rest]  (legacy Django URL redirects; src/params.ts)
```
Guards are centralised in `src/hooks.server.ts`, not in per-route layouts. `/teacher`, `/student`, `/admin` and `/onboarding` redirect to `/login?next=` when signed out. Role mismatches redirect to `/`. Unverified email users go to `/verify?next=`. Teachers without a name or institute go to `/profile?next=`.

---

## 4. Motion

All motion is CSS keyframes in `app.css`, plus a tiny JS direction classifier. No animation library is used. The only Svelte transitions are `fly` in the PWA banners.

### Page transitions
- `src/lib/client/motion.ts` exports `navDirection(from, to, tabs, {pop, back})` and returns `forward | back | tab-left | tab-right`. Rules:
  - tab to tab compares tab indexes;
  - a popstate delta < 0, `data-back`, or going up the path (`from.startsWith(to+'/')`) means back;
  - anything else is forward.
- The layout's `beforeNavigate` computes the direction into a **plain variable**. Binding it reactively re-animated the outgoing page. Safari's own edge swipe is skipped through `hasUAVisualTransition`.
- Content renders in `{#key path}<div class="page-view" use:enter>`. `enter` sets `data-nav` and **removes it on `animationend`** (or after 700ms), because a lingering transform would trap `position: fixed` bars.
- Only the incoming page animates. Every page transition is **.18s**, with `animation-fill-mode: backwards`:

| Platform | forward | back | tab |
|---|---|---|---|
| default | `cq-push-in` translateX(18%) op .9, ease-snappy | `cq-pop-back` -12% | `cq-tab-right/left` ±5% op .85 |
| iOS | `cq-ios-push` translateX(28%) op .4, ease-ios | `cq-ios-pop` -16% op .6 | `cq-ios-tab` op .6 scale .99, ease-smooth |
| Android | `cq-md-through` op 0 scale .94, ease-material | `cq-md-back` scale 1.04 | `cq-md-fade` op 0 translateY(8px) |
| ≥1024px (any) | `cq-md-fade` (fade and rise) for everything | | |

- Pages containing `.actionbar` or `.fixed-bottom` only cross-fade, because a transform would make the fixed bar ride along.

### Utilities
- `.rise`: `cq-rise` (opacity 0, translateY(6px)) over .22s ease-snappy, staggered with `style="--i:n"` as `delay: min(n*20ms, 100ms)`. On iOS it uses `cq-rise-spring` (translateY(8px) scale(.985)) over .28s ease-spring.
- `.fade-in` (.3s) and `.press` (`:active` scale .97 brightness .96, ease-spring .22s).
- Buttons scale to .98 on active (iOS: .97 plus opacity .8). Chips scale to .96, segmented items to .97.
- **Android ripple**: a `::after` circle grows from `--rx/--ry`. The layout records the pointer position on `pointerdown`, Android only. It applies to `.btn, .list-row, a.card, .chip, .icon-btn, .segmented > *, .press, .app-fab`.
- Tab bar slides in (`cq-tabbar-in` .35s). FAB uses `cq-app-fab-in` (scale .5 to 1, .42s spring). Sheets use `cq-sheet-in` from translateY(100%) over .24s; iOS uses .5s ease-ios; desktop uses `cq-pop-in` scale .97 over .18s. Toasts use `cq-toast-in` (.22s). Select popovers use `cq-drop-in` (.12s). The skeleton shimmers over 1.4s. The live badge pulses over 1.6s. The `btn-spinner` spins over .7s.
- Attempt page: the question card slides in from the travel direction (`q-in` .28s, ±28px). The tapped bubble pops (`bubble-pop` scale 1.18 over .32s spring). The progress bar width animates over .4s. The timer pulses when ≤ 60s.
- `haptic(ms=10)` uses `navigator.vibrate`, works only on Android, and is skipped under reduced motion.

### Reduced motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```
`platform.ts` also exposes `reducedMotion()`.

---

## 5. PWA

### Manifest (`static/manifest.webmanifest`)
- `id "/"`, `start_url "/"`, `scope "/"`, `display: standalone`, `orientation: any`, `lang en-IN`.
- Background and theme colour `#f4f5f7`. Categories: education.
- Icons: 192 and 512 `any`, `icon-maskable-512` `maskable`, and an SVG.
- Shortcuts: "Join a quiz" (`/student/join`) and "New quiz" (`/teacher/quizzes/new`).
- Screenshots: narrow 390x844 and wide 1280x800. The PLAN calls the manifest "APK-ready" for a later Capacitor/TWA wrap.
- `app.html` also sets `apple-mobile-web-app-capable`, the title, `viewport-fit=cover`, and an apple-touch-icon.

### Service worker (`src/service-worker.ts`, SvelteKit's native SW, auto-registered)
- Caches:
  - `app-${version}`: precaches every `immutable` and `assets` file, added one asset at a time so a single 404 can't abort the install.
  - `pages-${version}`: per build, because old pages point at old bundles.
  - `fonts`: kept across builds.
- `activate` deletes the other caches and calls `clients.claim()`.
- **The install does not call `skipWaiting`.** The new worker waits until the UI posts `'SKIP_WAITING'`.
- The routing decision is a pure, unit-tested function in `src/lib/components/pwa/cache-route.ts`, `cacheRoute(method,url,origin,precached)`, which returns `'network'|'precache'|'page'|'font'`:
  - Non-GET requests go to the network. Requests that match `NEVER` also go to the network: `/q|attempt|api|_app|health|login|signup|logout|auth|forgot|reset|verify|role|pending|join`, the live board, the AI stream, CSV export, billing and `.csv`.
  - Precached paths are served cache-first.
  - Pages, and their `__data.json`, are **network-first**. Only `200 basic` responses are stored. When offline the SW serves the last good copy; `/` offline redirects to the cached `/student`, `/teacher` or `/admin`; anything else gets `/offline.html`.
  - Never-cached navigations still fall back to `/offline.html`.
  - Any request matching `AUTH` (`/login|signup|logout|auth|reset|verify`) **deletes the PAGES cache**, so the next person on the device never sees cached pages.
- `if (dev) return;` in fetch keeps the SW away from Vite's module graph.
- `static/sw.js` is a kill switch for the old Django worker. It skips waiting, deletes caches, unregisters itself and reloads clients.

### Auto-update flow (`src/lib/components/pwa/UpdatePrompt.svelte`, mounted in the root layout)
1. On mount (prod only), `navigator.serviceWorker.ready` gives the registration. It uses `ready` and not `getRegistration`, because on a first visit SvelteKit registers the worker later.
2. It checks for updates with `reg.update()` **on start, on `visibilitychange` to visible, and every 30 minutes**.
3. When `reg.waiting` is set, or `updatefound` leads to the installing worker reaching `state === 'installed'`, it offers the update. It only does so when `navigator.serviceWorker.controller` exists (so not on a first install) and **not while on `/q/**`** (never mid-quiz).
4. UI: a fixed card at the top centre (`top: safe-top + .5rem`, `width: min(24rem, 100% - 2rem)`, surface colour, shadow-lg, `fly y:-24 280ms`), showing a RefreshCw icon, "New version ready", a primary **Update** button ("Updating" while busy) and an X ("Later").
5. Update registers `controllerchange` (once) to run `location.reload()`, then posts `'SKIP_WAITING'` to the waiting worker. The page reloads exactly once.
6. `server.js` sends no-store for `service-worker.js`, the manifest and `_app/version.json`, so update checks always reach the origin.

### Offline behaviour
- `OfflineBanner.svelte`: a small ink-coloured pill reading "Offline" with a WifiOff icon, fixed at the top centre (z 60), driven by `online`/`offline` events with `fly y:-16 200ms`.
- `static/offline.html`: a self-contained, themed card ("You're offline"), with a Try again button that retries.
- The attempt page keeps answers in `localStorage` (see §8), so a dropped connection loses nothing.

### Install prompt (`src/lib/pwa/install.svelte.ts`)
- It captures `beforeinstallprompt` (`preventDefault`) into a module variable and exposes a reactive `canInstall = $state({value})` and `installApp()`. `appinstalled` clears it.
- The UI is an "Install" ghost button in the app bar (the label is hidden below `sm`) and in the sidebar footer, shown only when `canInstall.value` is true. There is no nagging modal and no iOS instructions sheet.

---

## 6. Auth (Google + sessions)

### Google (`src/lib/server/auth/google.ts`, routes `(auth)/auth/google/+server.ts` and `.../callback/+server.ts`)
- Server-side Authorization Code flow with **PKCE (S256) + state + nonce**, using `jose`. There is no auth library.
- `GET /auth/google?next=`:
  - `startFlow()` creates `state`, `verifier` and `nonce` (32 random bytes each, base64url).
  - The flow `{state, verifier, nonce, next}` is stored as a **signed HS256 JWT in an httpOnly cookie** `cq_oauth` (TTL 600s, sameSite lax, secure in prod).
  - It redirects to Google with `scope=openid email profile`, `prompt=select_account`. SvelteKit 3 needs `redirect(303, to, { external: ['https://accounts.google.com'] })`.
- Callback:
  - Reads and deletes the flow cookie and checks `state`.
  - `finishFlow` POSTs to the token endpoint with `code_verifier` (15s timeout).
  - It verifies the `id_token` with `createRemoteJWKSet(googleapis certs)`, checking RS256, both issuer forms, audience, nonce, and `email_verified === true`.
  - Name fields are trimmed to 80 characters. Only https picture URLs are kept.
- `signInWithGoogle` (in `services/auth.ts`) has three outcomes:
  - It signs in a verified Google email directly.
  - It auto-links an existing account with the same email. When that account was **unverified, it nulls its password** (anti pre-hijack, SECURITY.md #2).
  - Otherwise it creates a student account.
- Failures log `[auth] google sign-in failed {why, host, error}` and redirect to `/login?error=google&next=…`.
- `redirectUri` = `GOOGLE_REDIRECT_URI ?? ${ORIGIN}/auth/google/callback`. It is never built from the Host header.
- `InAppBrowser.svelte` warns users inside in-app webviews (Google blocks OAuth there).
- The Google button only shows when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set (`googleEnabled()`).

### Sessions (`src/lib/server/auth/session.ts`)
- The session is a **stateless HS256 JWT** in the httpOnly cookie `cq_session`, with claims `{sub, typ:'session', sv}`.
- TTL is 30 days, and the cookie is re-issued once it is past half-life (sliding). The cookie is `secure` except in dev, because WebKit drops Secure cookies on localhost.
- `AUTH_SECRET` is at least 32 characters and is shared with reset, verify and OAuth tokens. `typ` is required so one token kind can't be replayed as another.
- `hooks.server.ts` loads the user row **on every request** with `getUser`:
  - Suspension, role changes and `sessionVersion` take effect immediately.
  - Bumping `users.sessionVersion` (on logout, password reset, or a Google relink that drops the password) revokes all existing tokens.
  - A DB failure returns 503 and not a silent sign-out.
- `safeNext()` allows only same-origin relative paths and rejects auth routes, which prevents loops.
- `homeFor(user)` returns `/teacher`, `/admin` or `/student`.
- Admin access requires `isAdmin`, or a **verified** email listed in `ADMIN_EMAILS`.
- Email and password auth also exist (`password.ts`; legacy Django pbkdf2 hashes are upgraded on login). Verification and reset mail go through nodemailer `SMTP_URL`.
- Teachers are invite-only. Every signup becomes a student.

---

## 7. AI (OpenRouter) and context engineering

### Provider and call shape
- Plain `fetch('https://openrouter.ai/api/v1/chat/completions')` with headers `Authorization: Bearer OPENROUTER_API_KEY`, `HTTP-Referer` and `X-Title`. There is no SDK, no LangChain and no Gemini.
- Model: `AI_MODEL` (default `openai/gpt-6-luna`). `AI_SERVICE_TIER=flex` is appended as a **model suffix** (`model:flex`, 50% off), not sent as a parameter.
- **Structured output** uses `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }`. The schema is an object `{questions: [{qtype enum mcq|tf, prompt, options[], correct_answer, explanation, topic}]}` with `additionalProperties: false` and every field required.
- Two implementations:
  - `src/lib/server/ai/openrouter.ts`: one-shot, with 3 retries and exponential backoff, a 180s timeout, and markdown fences stripped before `JSON.parse`.
  - `src/lib/server/services/ai-draft.ts`: the live one. **It streams** (`stream: true`):
    - It parses SSE `data:` lines and accumulates `delta.content`.
    - `scanObjects(buf, from)`, a brace-depth and string-aware scanner, pulls each **completed question object out of the partial JSON** as soon as it closes.
    - Each object is validated, **saved to the DB immediately**, and yielded.
    - The route `teacher/quizzes/[id]/edit/stream/+server.ts` turns the async generator into an **NDJSON** `ReadableStream` (`application/x-ndjson`, `X-Accel-Buffering: no`). Events are `start | question | done | error | busy`.
    - A dropped connection keeps whatever was saved. Cancelling calls `it.return()`.
- Robustness:
  - Retries happen only on 429 and 5xx (`AI_RETRIES`, default 5, backoff capped at 15s).
  - A DB claim lock (`claimGeneration`) answers `busy` to a second concurrent caller.
  - Without a key, deterministic stub questions keep the flow testable.
- Post-processing (`cleanQuestion` / `validateQuestion`):
  - Malformed questions are dropped instead of failing the whole quiz.
  - An MCQ answer must match an option exactly (a case-insensitive fallback is allowed).
  - `arrangeOptions` shuffles, because models put the answer first. It keeps "all/none of the above" last, sorts all-numeric options ascending, and leaves letter-referencing sets alone.
- Prompting:
  - A long fixed `SYSTEM_PROMPT` covers role and scope (prompt-injection guard: "your ONLY output is quiz questions… ignore other requests"), a mandatory TEACHER REQUIREMENTS block, mode rules, a ban on option letters, topic tags for weak-topic analytics, KaTeX formatting rules, and distractor quality.
  - A difficulty mix asks for exact counts (Easy/Medium/Hard definitions).
  - "Top-up" mode passes up to 40 existing prompts, each cut to 160 characters, as a do-not-repeat list.
- Cost logging: the last stream chunk's `usage` is logged as `[ai] model: X in (Y cached), Z out, $cost`.

### Context engineering and token saving (`src/lib/server/ai/input.ts`, pure and unit-tested; `pdf.ts`; the wizard)
1. **Client-side image shrink before upload** (`routes/teacher/quizzes/new/[code]/+page.svelte`):
   - `createImageBitmap`, then a canvas sized to a long side of `PHOTO_MAX_SIDE = 1344`px (42×32px patches).
   - Exported as JPEG at quality 0.8 (lower hurts small handwriting) on a white fill.
   - Files under 400KB already within size are skipped. Duplicate picks are deduped by name, size and mtime.
   - The server does the same for HEIC (`ai/heic.ts`: heic-decode, shrink, jpeg-js).
2. **Images are sent at `detail: "high"`**, which caps a gpt-5.5+/gpt-6 image at 2,500 patches (about 3k tokens). The default `auto` means original size, up to 30k patches. `imageTokens()` models this cost.
3. **PDFs: send the text layer, not the file.**
   - `readPdf` (unpdf) extracts per-page text **once at upload** into `quiz_sources.rawText`.
   - `pdfText()` decides between text and scan. At least 60% of pages need ≥ 40 characters and the average must be ≥ 150 characters per page; otherwise the PDF is treated as a scan.
   - A native PDF input would cost text plus about 3k tokens per page image. Only real scans are sent as a `file` part.
   - Older rows are back-filled lazily.
4. **Text cleanup**:
   - `cleanText` unifies line endings and squeezes spaces and blank lines.
   - `stripRepeatedLines` drops page numbers and running headers and footers (a short line on at least half the pages, when there are 3 or more pages).
   - `budgetTexts` dedupes identical paragraphs across all sources; paragraphs under 40 characters are kept.
5. **One text budget for all sources**: `TEXT_BUDGET_CHARS = 120_000` (about 30k tokens at 4 characters per token).
   - Short sources stay whole. The remaining budget is shared evenly by the long ones.
   - `fitText` keeps the **first ~25% of paragraph-aligned 1500-character blocks** (definitions and summary), then samples blocks **evenly spread** across the rest, joined with `[...]`.
6. **Visual budget**: `VISUAL_BUDGET = 40` page-images per draft. `capVisuals` drops uploads with `spread()` (evenly, keeping the first and last) rather than truncating. Scans over `MAX_SCANNED_PAGES = 20` are refused at upload.
7. **Prompt-cache-friendly ordering**:
   - The system prompt and the material come **first**, in stable (oldest-first) source order.
   - The per-request ask (title, count, difficulty, teacher requirements, top-up) comes **last**, after `=== END SOURCE MATERIAL ===`.
   - Regenerate and top-up therefore share an identical prefix that the provider's automatic prompt cache bills cheaply, and cached tokens show in the log.
8. **Output cap**: `max_tokens = 2000 + n*500`. The number of questions is clamped to `AI_MAX_QUESTIONS_PER_QUIZ` (20).
9. Draft options are handed from the wizard POST to the stream request through Redis (`ai_draft_opts:{quizId}`, TTL 2h), with an in-process Map fallback.
10. `estimateInputTokens()` exists to measure savings, but an AI token estimate is **not shown in the UI** (dropped by the SIMPLICITY RULE).

---

## 8. Test / quiz-taking UX

Files: `src/routes/q/[code]/attempt/+page.svelte` (631 lines), `+page.server.ts`, `attempt/answer/+server.ts`, `src/lib/server/services/attempt.ts`, and `src/routes/student/attempts/[id]/+page.svelte` for results.

- **Immersive**: `:global(body:has(.attempt) .appbar) { display:none }`. There is no tab bar or sidebar (a full-screen route).
- **Quiz bar** (sticky, blurred):
  - An X icon-button "Leave quiz (answers are saved)".
  - The title and "N of M answered".
  - A timer pill in mono font. It turns danger-tinted and pulses at ≤60s, with `role="timer"`.
  - A 6px progress bar flush underneath.
- **One question at a time**:
  - Eyebrow "Question i of n · topic", a save-state slot ("Saving" spinner, "Saved" check, or "Saves on submit" cloud-off, `aria-live`), and the prompt rendered by `MathText` (KaTeX).
  - Options are **OMR bubbles** (`.omr` label with a hidden radio, a mono letter bubble A–D or T/F, and the text). The picked bubble fills with ink and pops.
  - The card slides in from the travel direction.
- **Navigation**:
  - The bottom `.actionbar` (inline on desktop) has Previous (icon-only on phones), a grid button `▦ 3/20`, and Next (ink) or Submit quiz (primary) on the last question.
  - Swipe left or right (≥60px and mostly horizontal). Swipes are ignored inside `pre`, `.katex-display` and tables.
  - Keyboard: arrow keys move, and A–D, 1–4 or T/F pick an answer.
  - Changing questions scrolls to the top only when the page is scrolled down.
- **Question palette**:
  - Phones and tablets: a `Sheet` (bottom sheet) with a grid of numbered squares, at least 48px each. Answered squares are ink-filled; the current one has a ring outline. A legend reads "Answered / Not yet". The footer has Submit quiz. When questions are unanswered it warns "N unanswered. You can still submit; they count as skipped."
  - ≥1024px: the same grid sits in a sticky side panel (`grid-template-columns: 1fr 15rem`, 4 columns) with its own Submit button.
  - "Submit" with unanswered questions opens the palette first.
- **Autosave and resilience**:
  - Each pick is written to `localStorage` (`cq-attempt-picks-{attemptId}`) and POSTed to `/q/[code]/attempt/answer` (Zod body). The request has a 20s timeout and retries with backoff at 500, 1000, 2000 and 4000ms.
  - A 409 from the server means the attempt is closed, and the client auto-submits.
  - On mount, local picks are merged and only the picks that differ from the server's are flushed.
  - On `visibilitychange` to hidden, a `keepalive` fetch flushes dirty picks.
  - The final submit is a progressively enhanced `<form>` carrying hidden inputs for every pick, so the submission itself is the source of truth.
  - A `pageshow` from bfcache triggers a reload.
- **Timer**:
  - The server's `attemptDeadline` is `startedAt + durationMinutes`, else `expiresAt`. The client counts down to it and auto-submits at 0, locking picks first.
  - The server allows `DEADLINE_GRACE_MS = 180_000` beyond the soft deadline for slow mobile saves, then rejects answers.
  - `mustSubmit` (deadline passed, or the teacher closed the quiz) makes the client flush and submit on load.
  - Questions are shuffled with a seeded shuffle keyed by the attempt id, so the order survives a reload.
- **Result page** (`student/attempts/[id]`, `.page-narrow`):
  - A back-link to Home.
  - A `.score-ring` card (a conic gradient with `--pct` and `--tone` set to success, warning or danger) showing the percentage and "x of y".
  - A 3-up `.stats` row: Correct, Wrong, Skipped.
  - A Leaderboard list in which the user's own row is primary-tinted.
  - "Review answers" cards for every question, with a Correct/Wrong/Skipped badge, the prompt, and static OMR options in `is-correct`/`is-wrong` states labelled "Your answer" or "Answer". A lightbulb explanation box sits on a muted background.
  - Everything is staggered with `.rise --i`.
- Teacher side: a live board (`teacher/quizzes/[id]/live`, `LiveStats.svelte`, large enough for a projector), results with a CSV export (protected against formula injection), and insights by topic.

---

## 9. Reusable components worth copying

UI primitives in `src/lib/components/ui/` are barrel-exported from `index.ts`:

| Component | What it does |
|---|---|
| `Button.svelte` | `.btn` variants (primary, ink, secondary, ghost, danger, success; sm or lg) with a loading spinner |
| `Card.svelte`, `ListRow.svelte` | Card with head and sub; a list row with leading icon, title, meta, trailing slot and chevron (`href` renders a link, `onclick` a button) |
| `PageHeader.svelte` | Page title (large-title aware), subtitle and actions |
| `Sheet.svelte` | `<dialog>` that is a bottom sheet on phones and a centred dialog at ≥768px; Esc and backdrop close it; title, description and footer snippet |
| `ConfirmDialog.svelte` | Centred "Are you sure?" that takes either `onconfirm` or a form `action` (progressively enhanced) |
| `Select.svelte` | Custom listbox in the **popover top layer**, flips above when there's no room, a hidden input carries `name` |
| `Tabs.svelte` | Segmented tabs: `href` for page tabs, or bound `value` with arrow keys |
| `Switch.svelte` | Whole-row tappable switch with label and one-sentence description; submits like a checkbox |
| `Field.svelte` | Wraps a native input, select or textarea with label, help and error |
| `Stat.svelte`, `Badge.svelte`, `EmptyState.svelte`, `Skeleton.svelte` | Number tile; badge variants (live pulse, draft, closed, primary, danger, success, warning); dashed-icon empty state with actions; shimmer rows |
| `Toaster.svelte` + `toast.svelte.ts` | `toast(msg, tone, ms)` writes to a `$state` array; ink-coloured toasts sit above `--bottom-space` (bottom-right on desktop) |
| `ThemeToggle.svelte` | See §2 |

Other components and modules:
- PWA, in `src/lib/components/pwa/`: `UpdatePrompt.svelte`, `OfflineBanner.svelte`, `cache-route.ts` (+ test). Also `src/lib/pwa/install.svelte.ts`.
- Client helpers, in `src/lib/client/`:
  - `platform.ts`: `platform()`, `haptic()`, `reducedMotion()`
  - `motion.ts`: `navDirection` (+ test)
  - `history.ts`: smart back
  - `fab.ts`: global FAB store
- Admin, in `src/lib/components/admin/`:
  - `DataTable.svelte`: one markup, a table at ≥640px and a card list on phones; each column declares its phone slot
  - `Toolbar.svelte`: GET search with URL state, a filter and actions
  - `Pager.svelte`
  - `AdminTabs.svelte`, `DetailTabs.svelte` (`?tab=`, replaceState)
  - `Flash.svelte` (form result message)
  - `nav.ts` (grouped nav)
- Student:
  - `student/CodeInput.svelte`: one OMR cell per character over a transparent native input, so paste, autofill and IME work and typing before hydration survives
  - `student/dashboard/{TrendChart,Leaderboard,TopicList,AttemptRow,Announcements}.svelte`; TrendChart is a hand-rolled SVG with a table fallback for screen readers
- Teacher:
  - `teacher/Math.svelte` + `katex.ts`: KaTeX auto-render bundled locally (CSP-safe), re-keyed on text; also handles circuit fences
  - `teacher/QuestionView.svelte`, `LiveStats.svelte`, `ShareCard.svelte`
  - `teacher/Dropdown.svelte` and `FilterSheet.svelte`
  - `teacher/authoring/ActionBar.svelte`: sticky bottom bar above the safe area that rides the keyboard; `desktop='inline'|'hidden'`
  - `WizardSteps.svelte`, `BatchPicker.svelte` (typeahead with bold match and a "New batch: x" row), `QuestionForm.svelte`
- `forms/DynamicForm.svelte`: admin-defined onboarding form renderer with live format checks on blur. The server re-validates.
- `branding/BrandHeader.svelte`: per-teacher logo, colour and name, memoised per tab. `contrast.ts` (+ test) handles colour contrast.
- CSS-only primitives to copy as they are:
  - `.omr`, `.omr-code`, `.score-ring`, `.progress`, `.segmented`, `.chips`, `.actionbar` (+ `.inline-desktop`)
  - `.list` with **iOS inset hairlines**
  - `.combo`, `.empty`, `.stats`
  - `.back-link`, `.section-head`, `.eyebrow`

---

## 10. Rules from CLAUDE.md and docs

From `CLAUDE.md`:
- Start a session by reading `docs/HANDOFF.md`, then `docs/PLAN.md`. Memory notes live in `.claude/memory/`.
- **Bun only.** **Drizzle only in `src/lib/server/services/*`.** **Zod at every action and endpoint.** **Lucide icons, never emojis.**
- "Keep it simple … make the design premium and mobile-first."
- **Commit gate**: `bun run check` (0 errors), `bun test`, `bun run build`.

**SIMPLICITY RULE** (`docs/PLAN.md`, overrides everything):
- One clear primary action per screen and plain words. Never show jargon such as "feature flag", "override", "slug" or "layer".
- Use sensible defaults. Put advanced options under "More options" or remove them. Keep fields and steps few.
- Keep optional features invisible unless they are switched on: no empty sections and no "disabled" teasers.
- Admin common jobs must take 1–2 clicks.
- Explicitly dropped: drag-to-reorder (use up/down), an AI token estimate shown in the UI, and a "Device" theme option.
- When in doubt, choose less complexity.

Design directive:
- "Best possible design, simple and premium." Calm layout, generous spacing, strong hierarchy, and real empty, loading and error states.
- Subtle motion, perfect at **390px** and in dark mode.
- Use the shared UI primitives with no raw colours. Tokens live only in `src/app.css`.

Round 7 standards:
- No horizontal scroll at any width. Tap targets are at least 44px. Respect safe areas and `prefers-reduced-motion`.
- Test at 360, 390, 768, 1280 and 1440 widths, light and dark, with iOS and Android UAs (the platform CSS differs).

Memory and feedback rules:
- **Verify reported bugs first**: reproduce them in Playwright at a phone viewport (375–390px, isMobile) with realistic, long data, fix, then re-test only that flow.
- **Multi-agent limits**: agents must not each run dev servers, crawls or full suites. Builders run `bun run check` once. The coordinator takes the Playwright screenshots.
- **Never add a Co-Authored-By: Claude trailer** to commits or PRs.
- Use parallel agents with strict file ownership (PLAN.md lists the ownership tables). Agents don't commit; the coordinator commits.

Security conventions (`docs/SECURITY.md`, all fixed):
- Admin rights require a verified email.
- Google auto-link nulls an unverified password.
- Rate limits are applied in hooks.
- Reset and verify links are built from ORIGIN only.
- Signed-in pages are `private, no-store`.
- Response headers: X-Frame-Options DENY, nosniff, HSTS in production, a strict Referrer-Policy on reset and verify pages, a Permissions-Policy, and COOP `same-origin-allow-popups` (for Razorpay).
- CSP runs report-only through `/api/csp-report`.
- `www.` redirects 301 to the bare host so the Google callback and cookies match.

Other docs: `docs/DEPLOY.md` (Dokploy deploy with an entrypoint migration, `scripts/migrate.ts`, and a `RUN_MIGRATIONS` env), `docs/MIGRATION.md` (Django data cut-over), `docs/MANUAL.md` (user manual) and `docs/PARITY.md` (feature parity with Django).
