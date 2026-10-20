# UCI rebuild: requirements

Distilled from the owner's 65 prompts (2026-10-20). Every agent reads this before touching code.
The previous Cursor attempt is preserved at git tag `cursor-attempt` and must not be used as a design reference: the owner rejected it.

## Product

A coaching institute (UCI) app: public website, student LMS and exams, teacher/admin management.
It must keep every feature and every user type of the legacy prototype in `legacy/` (inventory: `docs/research/legacy-features.md`).
The bar is a premium, high-budget product that beats competitors on user experience, animation, design, flow and ease of use.

## Stack (locked)

- SvelteKit + Svelte 5 runes, Bun, TypeScript strict, `adapter-node` (the `sveltekit-pro-max` skill laws apply).
- Postgres + Drizzle behind feature services, Valkey cache, Zod at every boundary, Tailwind v4 tokens in one file.
- Google sign-in only.
- AI: Gemini first (LangChain structured output); OpenRouter via LangChain as the fallback when Gemini fails. Pick the best Gemini model per task after testing them.
- AI context engineering: send the smallest possible context (as in campusquiz-svelte, or better) so credits last.
- Files and documents: private Cloudflare R2 bucket.
- PWA with auto-update (as in campusquiz-svelte and the other references). Later wrapped as Android APK and iOS app, so the UI must feel native on phones.
- Deploy target: `uci.divyanshshukla.com` on the owner's Dokploy. Code on the owner's GitHub.
- Keys already live in `.env`. Never print or commit them.

## References (read before designing; digests in `docs/research/`)

- `/Users/divyansh/Desktop/code/campusquiz-svelte`: primary pattern source (shell, tokens, PWA, AI, quiz UX).
- `/Users/divyansh/Desktop/code/abizer-sir/easy-business`: design, theming, navigation, responsiveness, management UX.
- `/Users/divyansh/Desktop/code/campusquiz-next`, `/Users/divyansh/Desktop/skindost`: landing, LMS, notes, motion.
- `legacy/`: the features to keep.

## Design and UX

- Fully responsive on phone (iOS, Android), tablet and desktop. No horizontal scroll and no scroll gutter anywhere.
- Must not look AI-generated or templated. Distinctive type and theme, every font readable in both themes.
- Light/dark theme switch.
- Professional navigation: organised route tree, breadcrumbs on desktop, back buttons on mobile, clear page headers, a deliberate end-to-end flow.
- Multi-page where it helps (separate pages over overloaded single screens).
- Motion fits the platform: calm, non-bouncy on desktop; native-feeling on mobile. Each page entrance plays once, with no double bounce on load. Respect reduced motion.
- No layout shift on load. Loading states (skeletons) wherever data or media loads.
- Never emojis; one premium icon set.

## Public website

- A strong public index page (not generic) plus `/legal` pages (privacy, terms, cookies, refunds as needed) and other public pages.
- Intro video (`static/intro.mp4`, source in `assets/intro-source.mp4`): muted, no controls, plays once (no loop), reserved space with a poster/loading state so nothing shifts.
- Brand assets: `static/brand/uci.png`, `assets/channel-profile.jpg` (YouTube channel image).

## Student LMS

- Courses with YouTube-embedded video lessons; a real LMS feel (progress, continue watching, lesson list).
- Notes rendered from Markdown (good reading typography), not ad-hoc HTML.

## Tests: three kinds

1. Simple (open) tests.
2. Password-protected (scheduled) tests.
3. Tests assembled by teachers from their own modules / question banks.

Test-taking UX on par with or better than Testbook/PW: palette, timer, autosave, results and solutions.

## Teacher/admin

- Every capability the legacy admin had (verify against the legacy inventory).
- AI: upload a PDF and generate questions automatically.
- Built to scale as data grows: organised by session (academic batch/year), easy to find, view, filter and manage.
  Desktop and phone may use different layouts and placements for the same task.

## Process

- Plan first, then execute, with parallel agents on separate files.
- Verify with Playwright on phone, tablet and desktop; produce a review page with screenshots of every page.
- Check logs; no "Something went wrong" crashes, no hydration errors.
- English only UI (owner 2026-10-21): no Hindi strings or bilingual subtitles anywhere.
