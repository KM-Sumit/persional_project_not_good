# Research: campusquiz-next + skindost (references for the UCI SvelteKit LMS)

Read-only survey, 2026-10-20. Paths are absolute. `CQ` = `/Users/divyansh/Desktop/code/campusquiz-next`, `SD` = `/Users/divyansh/Desktop/skindost`.

**The short version:** neither project has a marketing landing page with video, and neither embeds YouTube. Their value to us is the token system, the theming switches, the safe markdown reader, the SW and update patterns, the nav and shell rules, and the motion vocabulary. The landing page and the YouTube player have to be designed fresh (see section 3 and section 4).

---

## 1. Stack

| | campusquiz-next (CQ) | skindost (SD) |
|---|---|---|
| Framework | Next.js **16.2** App Router, React 19.2 | Next.js **15.1** App Router, React 19.0, custom `server.ts` (socket.io) |
| Runtime / PM | **Bun** only (`CQ/AGENTS.md` law 8) | pnpm, tsx |
| DB | Drizzle + Postgres (`:5434`) + Redis (`:6381`), LRU→Redis `cached()` contract | Drizzle + Postgres 18 + Redis + BullMQ |
| Auth | next-auth v5 beta | next-auth v5 beta (JWT), phone OTP + native Google |
| UI | Tailwind v4, shadcn/Radix (`radix-ui`), lucide, `motion` 12, sonner, cmdk, nuqs, recharts, katex, pdfjs-dist | Tailwind v4, shadcn, lucide, tiptap, DOMPurify, recharts, Capacitor 8 |
| PWA | Hand-written `CQ/public/sw.js` | **Serwist** (`@serwist/next`, `SD/src/sw.ts`) |
| Lint | Biome + ~60 `audit:*` scripts in `bun run verify` | ESLint |
| Fonts | `next/font/google` Geist + Geist Mono (`CQ/src/lib/fonts.ts`) | Self-hosted `@fontsource` Geist Variable, Geist Mono, Instrument Serif, Noto Sans Devanagari (`SD/src/app/layout.tsx:5-12`) |

Architecture rule they share, which maps onto our sveltekit-pro-max layout: **the ORM never escapes `features/*/server/`**. Routes and components get DTOs, never rows and never a `Date` across the client boundary (`CQ/AGENTS.md`, "The laws" #1).

---

## 2. Design tokens, fonts, theme switching

### CQ: "dense dark instrument" (`CQ/src/app/globals.css`, 712 lines)
- All tokens sit in one file, mapped through `@theme inline`. Rule: "Design tokens live only in `globals.css`… never a raw hex" (`AGENTS.md` law 6).
- Colours are **OKLCH**. The accent is split so that hue and chroma come from the preset and lightness comes from the theme:
  ```css
  [data-accent="teal"] { --accent-c: 0.115; --accent-h: 182; }
  :root   { --accent-l: 0.635; --primary: oklch(var(--accent-l) var(--accent-c) var(--accent-h)); }
  .light  { --accent-l: 0.485; }  /* lowered so accent text holds WCAG AA (audit:contrast checks 80 pairs) */
  --brand-subtle: color-mix(in oklch, var(--primary) 16%, var(--background));
  ```
- There are **four user-controlled axes**, all set as attributes on `<html>`: `data-accent` (8 hues), `data-density` (`--row-py`, `--control-h`, `--text-row`), `data-surface` (5 background shades per mode, from slate to true OLED black and from white to sepia), and the `.light`/`.dark` class from next-themes. Dark is the default. The axis list is in `CQ/src/features/appearance/config.ts`.
- A **pre-paint boot script** applies the stored axes before hydration, which prevents a flash: `<script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />` (`CQ/src/app/layout.tsx`).
- Semantic tokens: `success`, `warning`, `danger`, `info` and `live`, each with a `-subtle` variant. Surfaces are `surface`, `surface-raised`, `surface-sunken` and `hairline`. Depth uses the `--elevation-*` tokens: "Depth comes from a hairline, not a blur."
- Radius is tight: `--radius: 0.375rem`, and every other radius is derived from it with `calc()`. Motion tokens are `--ease-out-quint: cubic-bezier(0.22,1,0.36,1)`, `--ease-spring: cubic-bezier(0.16,1,0.3,1)` and the durations 120/200/340ms.
- Base layer: `h1–h4 { text-wrap: balance; tracking -0.018em }`, `p { text-wrap: pretty }`, `.tabular` for tabular numerals (anything that ticks), a `::selection` colour mixed from the primary, and **hidden scrollbars everywhere**. Because the scrollbars are hidden, `.scroll-x` adds edge-fade shadows that need no JS.
- Component classes: `.panel`, `.panel-header`, `.row` (density-aware), `.eyebrow` (11px uppercase, tracking .09em) and `.key` (mono chip). Utilities: `.surface-ink` re-scopes all tokens to the sidebar ink, `.bg-accent-wash` (one off-centre radial bloom per page), `.bg-grid` (masked hairline grid) and `.shimmer`.
- Light mode keeps the **chrome in ink**: "Chrome stays ink even in light mode — that contrast is the product's face."

### SD: warm consumer/clinical (`SD/src/app/globals.css`, 1517 lines)
- Hex tokens on `:root`. The base is cream `--background: #faf7f2` with ink `#0e1116`. The accent is royal blue `#0249aa`, sampled from the logo. A sparing secondary pink (`--brand-pink`) is used for promos only.
- **Role tint:** flipping one attribute changes the theme, with no second stylesheet: `:root[data-role="doctor"]` gives cooler grey, a deeper blue and tighter radii (8→4px). `[data-surface="commerce"]` adds shop-only tokens.
- An **explicit type scale** is registered as Tailwind tokens, written 390px-first: `--text-display 2.5rem/1.1`, `--text-h1 1.75rem`, `--text-h2 1.375rem`, `--text-h3 1.125rem`, `--text-body 1rem/1.6`, `--text-label .875rem` and `--text-caption .75rem`. Components then use `text-h1`, `text-body` and the rest.
- Semantic radii: `rounded-card`, `rounded-control`, `rounded-t-sheet`.
- Serif (Instrument Serif) is "for hero / emotional moments only — never lists, forms" (`.font-display`, globals.css:506).
- Theme switching uses next-themes through `AppThemeProvider`, plus a **theme gate**: first paint is forced light until a later session opts in (`SD/src/lib/theme-gate.ts`, `THEME_GATE_BOOTSTRAP_SCRIPT`).
- Safe-area tokens (`--safe-top`, `--safe-nav`, `--safe-bottom = nav + 0.75rem gap`) and `--keyboard-height` exist so the app shell never re-pads. The only padding sits on `html` (globals.css:~350).

**Take for UCI:** CQ's OKLCH accent split, the `color-mix` subtle tones, `.eyebrow`, `.panel`, `.tabular` and `.scroll-x`, plus SD's named type scale and semantic radii. Put them all in one `src/app.css`. Use the boot script for theme, set before paint.

---

## 3. Public landing page

**There is no landing page in either repo to copy wholesale.**
- SD: `SD/src/app/page.tsx` is only a redirect router ("there is no public landing page (mobile-only app)"). `SD/www/index.html` is an offline "Turn on Wi-Fi" screen for Capacitor, not marketing. Marketing video work lives in `SD/marketing-video/` (a Remotion project) and `SD/docs/marketing/creatives/*.html` (ad mock-ups), not on the site.
- CQ: `CQ/src/app/(marketing)/page.tsx` (151 lines) is deliberately a **student code-entry page**, not a sales page. The pitch lives at `CQ/src/app/(marketing)/for-institutes/page.tsx` (313 lines).

### CQ `/` section order
1. Hero: `section.bg-accent-wash` with `.bg-grid` overlay, an `eyebrow` with a 6px rule ("— Campus Quiz"), an H1 ("Got a code from your teacher?", `text-4xl sm:text-5xl tracking-[-0.03em] leading-[1.08]`), a one-line sub, the `<StudentEntry>` code box centred `max-w-sm` and placed under the thumb, then a "Sign in" link.
2. Three reassurance items in a `<dl>` grid with icon tiles (Smartphone / ClipboardList / LineChart).
3. A "No code yet?" explainer.
4. One quiet buyer door: "Do you run a coaching institute?" with an outline button linking to `/for-institutes`.

### CQ `/for-institutes` section order
Hero (`bg-brand-wash`, a 2-sentence pain statement, a primary and an outline `size="lg" h-12` CTA pair) → "Live, during the test" split section with an **animated live-board preview** (`CQ/src/features/marketing/components/live-preview.tsx`, motion springs) → `#how` four steps → feature cards (`rounded-2xl border p-6 shadow-xs`) → a "Workspace modes" band using `.surface-ink` → an FAQ-like band on `bg-surface-sunken` → a centred closing CTA.

### Why it reads as premium
- One audience per page. Copy is concrete, with no lorem-style marketing phrases.
- Hairline borders between sections (`border-b` on each section) instead of floating cards. One accent bloom per page, at most.
- `text-balance`/`text-pretty` and tight negative tracking on headlines. Mono numerals.
- A real product preview animates in place of a stock illustration, and it **freezes when `useReducedMotion()`** is set.
- Marketing layout (`CQ/src/app/(marketing)/layout.tsx`): a sticky `h-14` header, `bg-background/85 backdrop-blur-md border-b`, `max-w-6xl` container, nav hidden below `md`, **one primary CTA only** ("Sign in"), the appearance panel in the header, and legal links in the footer only.

**For UCI (our call, not copied):** hero with a muted autoplay YouTube trailer, or a poster with a click-to-play facade → results/toppers → courses grid → faculty → test series → testimonials → FAQ → contact/admission CTA. Borrow CQ's chrome (sticky blur header, hairline sections, eyebrow + balanced H1, a single primary CTA).

---

## 4. LMS: course page, lesson/video, notes reader

### Course page and progress (CQ)
- Student view: `CQ/src/features/courses/components/student-course.tsx` (177 lines). A `.panel` with a header showing `{done}/{all.length} done` in `.tabular`, sections as sticky-looking sub-headers (`bg-secondary/40 text-xs`), and lessons as `.row` items with a checkbox. Locked lessons are **shown dimmed with an "Opens on {date}" line**, not hidden (drip by `unlockAfterDays`, via `unlockState()` in `features/courses/shared.ts`).
- Progress is a manual checkbox that calls the `setLessonCompleteAction` server action, then `router.refresh()`. Completing every lesson issues a **certificate** with a serial, verifiable at `/verify/[serial]`.
- One important rule, from a code comment: **the denominator is the whole course, not the unlocked lessons**, "a drip denominator shrinks, so the fraction goes backwards on its own."
- Teacher builder: `CQ/src/features/courses/components/course-builder.tsx` (562 lines). Public catalogue: `CQ/src/app/(student)/learn/[slug]/page.tsx`. Enrol page: `CQ/src/app/(student)/c/[slug]/page.tsx` plus `enrol-button.tsx`.
- Lesson attachments: a PDF opens in the in-browser reader `CQ/src/features/content/components/pdf-reader.tsx` (pdfjs-dist, dynamic import, browser canvas). Other files download.

### YouTube / video
- **Neither repo has a YouTube player.** CQ only recognises YouTube links as a host label: `CQ/src/features/live-classes/shared.ts:75` `if (host.endsWith("youtube.com") || host.endsWith("youtu.be")) return "YouTube";`. The library accepts "Drive, YouTube, anything" as a plain link (`library-panel.tsx:46`).
- So the UCI player is new work. Recommended: a `youtube-nocookie.com/embed/{id}` lite facade (thumbnail first, iframe on click), the IFrame API for `onStateChange` and time, saving `positionSec` and `percentWatched` periodically, and auto-completing at ≥90%. Keep CQ's whole-course denominator and the visible locked lessons.

### Notes / markdown reader
Two safe approaches. Either works for us:
1. **CQ renders markdown into React nodes with no HTML at all**, so nothing needs sanitising: `CQ/src/components/shared/markdown-text.tsx`. It supports h2/h3 (all `#` levels clamp to h2/h3 because the page owns the h1), paragraphs, quotes, ordered/unordered lists, fenced code and rules, plus inline bold, italic, code and links. Links are allowed only for `https?://` and `/`, and maths runs through `MathText` (KaTeX) on every leaf. Typography: `space-y-3 text-sm leading-relaxed`, and code blocks use `bg-secondary scroll-x rounded-md p-3 text-xs`.
2. **SD escapes everything, then emits whitelisted tags with baked classes**: `SD/src/lib/markdown.ts`. Rich HTML goes through **DOMPurify** with an explicit tag and attribute allowlist, and images are restricted to the CDN `articles/` prefix (`SD/src/server/articles/body-sanitize.ts`).
- SD reader typography (`SD/src/components/articles/article-body-prose.css`): `h2 → --text-h3, mt 1.5rem`; `p → --text-body, lh 1.625, color-mix(foreground 90%)`; a blockquote with a 2px **accent** left border, in italic muted text; `img` at full width, radius 1rem, with a border.
- SD reader page (`SD/src/app/app/learn/[slug]/page.tsx`): a `SubpageHeader` (back, category title, bookmark on the right) → optional cover `h-48 rounded-2xl` → meta row "Category · ⏱ N min read" → `text-h2` title → excerpt → an author card that links to a consult → the body. Bookmarks are stored per user, with a `/app/learn/saved` list.

**For UCI:** use CQ's no-HTML renderer pattern in Svelte (or marked plus DOMPurify on the server), SD's prose CSS values, and SD's read-time and bookmark meta row.

---

## 5. Legal pages

- **CQ** `CQ/src/app/(marketing)/privacy/page.tsx` and `terms/page.tsx` (~88 lines each). Content is a `SECTIONS: {title, body: string[]}[]` array, rendered in a `max-w-3xl px-4 py-16` column: H1 `text-3xl sm:text-4xl`, a one-line muted sub, then `space-y-8` sections with `h2 text-lg` and `p text-sm text-muted-foreground leading-relaxed`. The privacy sections are: who the data belongs to, what's stored about students, parents, payments, AI generation, deleting things, and asking us. The policy is "written from what the product actually does… If a statement here stops being true, that is a bug in the product."
- **SD** has a reusable shell, `SD/src/components/legal/legal-document.tsx`: `<LegalDocument title updated intro backHref>` plus numbered `<LegalSection n="1" title>`. The layout is `max-w-2xl px-5`, with a back button, `text-h1`, a "Last updated" caption, an intro paragraph and a closing disclaimer card. The entity details come from `SD/src/lib/legal/entity.ts` (`LEGAL_ENTITY`), and the grievance officer is read from env (`lib/legal/grievance-officer.ts`). Routes: `/privacy`, `/terms`, `/grievance`, `/telemedicine-consent`, `/delete-account`. Indian law references: DPDPA 2023, a grievance officer.
- **For UCI:** SD's component shape (numbered sections, last-updated date, entity constants, grievance contact for India) combined with CQ's honest, code-true copy. Add a `/refund` page if fees are taken online.

---

## 6. Navigation, responsive shell, breadcrumbs

- **CQ app shell** (`CQ/src/app/(app)/layout.tsx`, `CQ/src/components/shared/app-nav.tsx`): an ink sidebar (`.surface-ink`) on `lg+`. Below `lg` it becomes a hamburger `Sheet side="left" w-[17rem]`. The nav is a `Record<NavKey,{href,label,icon,badge}>`, and the active state is `pathname === href || startsWith(href + "/")`. **The sidebar is derived server-side** from role and flags: "an entry exists exactly when the screen behind it does" (`CQ/docs/PLAN.md`).
- **CQ section nav** (`CQ/src/components/shared/section-nav.tsx`): segment tabs with count pills (`urgent` uses the primary colour), disabled tabs that show a reason tooltip, and **group overflow into a "Set up" menu**, so a 360px phone does not end up with 9 tabs scrolled off-screen. The rule: "one screen, one job"; "If a screen needs tabs and a sidebar, it is two screens."
- **CQ page header** (`components/shared/page-header.tsx`): eyebrow → `h1 text-xl sm:text-2xl` → description `max-w-2xl`, with actions on the right, all over a `border-b pb-4`.
- **Breadcrumbs:** only CQ's library folder trail has them (`CQ/src/features/content/components/library-browser.tsx:269,528`): Home icon "Library" › ChevronRight › folders, with the last crumb in `text-foreground font-medium` and the rest muted. It sits in a horizontally scrolling `nav`.
- **SD mobile shell:** a bottom `TabBar` (`SD/src/components/tab-bar.tsx`) with 5 tabs, `aria-label="Primary"` and `aria-current`. A **sliding pill indicator** is positioned by measuring the active tab (`offsetLeft`/`offsetWidth`) and animated with `transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`. The active icon gets `strokeWidth 2.4` and `scale-105`, and the unread badge caps at "9+". Immersive routes (reader, chat, checkout) **hide the tab bar** and use `SubpageHeader` with a back button (`SD/src/components/layout/subpage-header.tsx`: shared `px-5` gutter, 44×44 header buttons with `active:scale-90`).
- The SD shell rule (`SD/CLAUDE.md`): body gets a definite `height:100dvh` flex column; each scroll region is `flex-1 min-h-0 overflow-y-auto`; the header and CTA are pinned while the middle scrolls. **Never `min-height:100dvh` on body.**

**For UCI:** CQ's sidebar (desktop) plus SD's bottom tab bar (phone) for the student app. A breadcrumb row on course → lesson pages. The marketing site keeps CQ's sticky blur header.

---

## 7. Motion patterns

- **CQ tokens** (globals.css): `--animate-rise: rise .36s cubic-bezier(.16,1,.3,1)` (6px up plus fade), `tick` (a changed number flashes the accent once), `shimmer` skeletons, `pulse-ring` for live badges and `scan` for the AI strip. A global `prefers-reduced-motion` block zeroes durations. In `live-preview.tsx`, `motion/react` springs (`stiffness 320, damping 30`) animate list inserts, and bar widths grow with `ease [0.16,1,0.3,1]`, gated by `useReducedMotion()`.
- **SD vocabulary** (globals.css:520-1260), all on `cubic-bezier(0.22,1,0.36,1)`:
  - `rise-fade .22s` for elements appearing after an interaction.
  - **Native-style page transitions**: `sd-nav-push-in` (translateX 18%→0, .34s), `sd-nav-pop-in` (-12%→0), and tab switches `sd-nav-tab-from-right/left` (±5%, .32s). These are driven by `SD/src/app/app/template.tsx`, which wraps `<PageTransition>`, with the direction computed in `SD/src/components/app/navigation-transition.tsx` (forward / back / tab-left / tab-right, keyed off tab index).
  - `sd-collapse-grid`: animates `grid-template-rows 0fr→1fr` for accordions, with no height JS.
  - `sd-segment-panel-in`, sheet rise/fall, `sd-pop` (overshoot spring for a completion moment) plus a `sd-burst` dot burst, `sd-ring-breathe` for a streak ring.
  - The `sd-nudge-bob` keyframe deliberately ends at rest ("Tailwind animate-bounce ends at translateY(-25%), which caused the jump").
- **For UCI (Svelte):** the `rise` entrance (play once; we already dropped the overshoot in commit e581265), the grid-rows collapse, push/tab direction transitions via `onNavigate` plus the View Transitions API, a progress-ring pop on lesson complete, and reduced-motion respected everywhere.

---

## 8. PWA auto-update

- **CQ** `CQ/public/sw.js`, hand-written, about 120 lines, registered by `CQ/src/components/shared/service-worker.tsx` **in production only and after `load`**:
  - It caches **only** `/_next/static/*`, the manifest and icons (content-hashed). Documents are **network-only**, and the `/offline` page is the fallback. `/api/*`, non-GET requests and cross-origin requests are never touched. The reason given: a shared front-desk phone would otherwise serve someone else's dashboard.
  - Update: on `install`, `skipWaiting()`; on `activate`, delete caches whose names don't end with the current `VERSION`, then `clients.claim()`. "A stale worker serving an old bundle is the classic PWA bug where a deploy appears not to have happened."
  - Manifest: `CQ/src/app/manifest.ts`, with `start_url: "/home"` (not marketing), `display: standalone`, dark `background_color` to avoid a white splash, a maskable icon and 2 shortcuts.
- **SD** uses Serwist: `SD/src/sw.ts` + `SD/next.config.ts:41` (`withSerwistInit({swSrc, swDest, cacheOnNavigation, reloadOnOnline, additionalPrecacheEntries:[{url:"/~offline", revision: gitSHA}]})`), with `skipWaiting: true, clientsClaim: true, navigationPreload: true`. Its routes: NetworkOnly for `/api/ping` and for sensitive APIs, NetworkFirst (5s timeout, 7-day expiry) for whitelisted read APIs and app-shell navigations, and a document fallback to `/~offline`. The client side is `SD/src/components/serwist-provider.tsx`, off in dev unless `NEXT_PUBLIC_SERWIST_DEV=1`. The **precache revision is the git SHA**, so each deploy invalidates the old cache.
  - Native store-update prompt: `SD/src/components/app-update-gate.tsx` + `SD/src/lib/app-update.ts` + `SD/src/server/app-version/store.ts`. It reads live store versions (iTunes lookup, scrapes Play), compares them with `compareVersions()`, and returns `optional`, which shows a dismissible sheet once per version, or `required` (below `MIN_SUPPORTED`), which blocks the app. It fails safe: any lookup failure shows nothing.
- **For UCI (SvelteKit):** `src/service-worker.ts` with `$service-worker` `build`/`files`/`version` (equivalent to CQ's VERSION and SD's git SHA), caching immutable assets only and keeping documents network-only plus `/offline`. In `kit.version.pollInterval`, combine `updated` from `$app/state` with a "New version — reload" toast, or reload on the next navigation. `skipWaiting` plus `clients.claim` in the SW.

---

## 9. Components worth copying (port to Svelte)

| Source | What | Why |
|---|---|---|
| `CQ/src/app/globals.css` | OKLCH accent split, `.panel` `.eyebrow` `.key` `.tabular` `.scroll-x` `.bg-accent-wash` `.bg-grid` `.shimmer`, reduced-motion block | Premium, themeable with one variable |
| `CQ/src/features/appearance/config.ts` + boot script | accent / density / surface / radius axes with no-flash boot | Theme switching done right |
| `CQ/src/components/shared/markdown-text.tsx` | No-HTML markdown → nodes, safe links, KaTeX leaves | Notes reader, XSS-free by construction |
| `SD/src/components/articles/article-body-prose.css` | Reader typography values | Notes typography |
| `CQ/src/features/courses/components/student-course.tsx` | Section list, locked-with-date lessons, whole-course progress, certificate | Course page skeleton |
| `CQ/src/components/shared/section-nav.tsx` | Tabs with count pills + overflow "Set up" group | Admin course/test sections on phones |
| `CQ/src/components/shared/page-header.tsx` | eyebrow / title / description / actions | Every inner page |
| `CQ/src/app/(marketing)/layout.tsx` | Sticky blur header, one CTA, footer legal links | Public site chrome |
| `CQ/src/features/marketing/components/live-preview.tsx` | Animated real-product preview, reduced-motion freeze | Landing hero/proof section |
| `SD/src/components/tab-bar.tsx` | Bottom tabs with measured sliding pill | Student phone nav |
| `SD/src/components/layout/subpage-header.tsx` | Back + title + right action, 44px targets, shared gutter | Lesson / note / test drill-downs |
| `SD/src/components/legal/legal-document.tsx` | `LegalDocument` + numbered `LegalSection` | Privacy / terms / refund |
| `SD/src/app/globals.css` (`sd-nav-*`, `sd-collapse-grid`, `sd-pop`) | Motion vocabulary | Page/tab transitions, accordions, completion delight |
| `CQ/public/sw.js` | Minimal, safe, self-updating SW | Basis for `src/service-worker.ts` |
| `SD/src/lib/app-update.ts` | `compareVersions` + verdict (none/optional/required) | If UCI ever ships a native wrapper |

---

## "Claude history" JS file

**Not found.** These were searched: both repos (excluding node_modules/build), `~/Desktop` and `~/Desktop/code` to depth 6–7, `~/Downloads`, `~/Documents`, and `/` to depth 6 for `*claude*` and `*history*` `.js`/`.mjs`/`.html` files. No design-history or showcase JS exists. Closest candidates:
- `~/.claude/history.jsonl`: the Claude Code prompt history (JSONL, 213 KB), one `{display, project, …}` per prompt. It is a prompt log, not a design showcase.
- `/Users/divyansh/Desktop/code/sumit/uci/flow/index.html` (deleted in the working tree, still in `HEAD`, recoverable with `git show HEAD:flow/index.html`): the old UCI "page flow" board with screenshots from `flow/shots/*`.
- `SD/src/app/dev/tokens`: the SkinDost design-token showcase route (moved from `/`).
- `/Users/divyansh/Desktop/code/campusquiz-svelte/src/lib/client/history.ts`: a SvelteKit router-history helper, not a design history.

Ask the user for the exact filename if none of these is it.
