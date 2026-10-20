# Design

**Source of truth for chrome, tokens, type, and widgets:** CampusQuiz (`campusquiz-svelte`) + Easy Business shell/motion. Do not invent a parallel system.

## Direction

Upendra Competition Institute, Sehore. Black and orange from their mark (`static/brand/uci.png`, about `#E86820`). Paper stays warm. Dark is warm charcoal, not blue-slate. Do not use the CampusQuiz bubble or pencil-blue.

Answer sheet for the live paper. Light = exam paper.

## Type (CampusQuiz)

| Role | Face |
|---|---|
| Display / titles | **Bricolage Grotesque** (`font-display`) |
| Body / chrome | **IBM Plex Sans** |
| Codes / timers | **IBM Plex Mono** |

Never use Source Serif / Georgia for UI. Never put display weight on meta text.

## Color tokens (HSL triplets on `:root` / `.dark`)

Ported from CampusQuiz `app.css`. Utilities map via `@theme inline` → `hsl(var(--token))`.

- `--muted-foreground` must stay ≥ ~42% L in light (AA on paper). Do not wash it further.
- Badges: tinted fill + **same-hue ink** (`badge-primary` = primary/12 bg + primary text). Never white text on soft tint.

## Chrome

- **&lt;1024:** app bar (brand + ThemeToggle) + bottom TabBar
- **≥1024:** sidebar rail (nav + ThemeToggle in foot); TabBar hidden
- Theme: `ThemeToggle` in chrome (CampusQuiz). `localStorage.theme` = `light` \| `dark`; `.dark` on `<html>`
- Document scrolls. Content column ~720px. Lists edge-to-edge; cards for lesson bodies / hero CTAs only

## Motion

Easy Business rules: desktop Material short fades, no bounce; iOS push/tab; Android fade-through. See `motion.ts` + `app.css` page-nav keyframes.

## Widgets to reuse (names from CampusQuiz)

`btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `icon-btn`, `card`, `badge` / `badge-primary`, `list` / `list-row`, `chip` / `seg`, `ThemeToggle`, `EmptyState`, `PageHeader`.

## LMS / Study (legacy UCI + CampusQuiz-next media)

Courses are **syllabus + lesson pages**, not one long scroll:

- `/courses/[id]` — syllabus list (chapters, lesson rows, module papers)
- `/courses/[id]/lessons/[lessonId]` — player, markdown notes, mark complete, next lesson
- Legacy `?lesson=` redirects to the lesson URL
- Lesson kinds: `text` | `video` | `pdf`; video uses `resource_url` → `YouTubeEmbed`
- Notes: markdown body via `renderMarkdown`, ~65ch `.md`, previous/next rows
