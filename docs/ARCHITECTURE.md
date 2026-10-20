# Architecture

UCI is an online-first exam app. Attempts are timed on the server, so the phone is not the source of truth. The service worker caches static assets only. Signed-in HTML always comes from the network.

## Stack

Bun, SvelteKit 3 (adapter-node), Svelte 5 runes, TypeScript strict, Drizzle over Postgres (`prepare: false` for PgBouncer), Valkey as a best-effort cache, Zod at the boundary, Tailwind v4 tokens in `src/app.css`, Lucide icons.

Local ports are 5436 (Postgres) and 6382 (Valkey) so they do not collide with other projects on this machine.

## Laws

- Drizzle is imported only from `src/lib/server/db` and `src/lib/features/*/server`.
- Routes call services and receive plain DTOs. Dates are epoch milliseconds.
- `env()` parses on first use. Nothing reads `process.env` elsewhere.
- Sessions store `sha256` of the cookie token. The cookie is httpOnly.
- Google sign-in is a server redirect with PKCE. `GOOGLE_OAUTH_MOCK=1` works only when `NODE_ENV` is `development` or `test`.
- Admins are the emails in `ADMIN_EMAILS`, applied on each sign-in.
- Marks are integer milli-marks (1000 = 1). Money is paise.
- R2 is private. The server will issue short-lived signed URLs. Postgres stores the object key.
- OpenRouter drafts questions. A missing key refuses to generate. It does not insert placeholders.
- Catalog lists go through `cached()`. Attempt state, sessions, and purchases do not.

## Not in this slice yet

Course and test editors, AI generation UI, banner and PDF upload, scheduled-test management, previous-year admin, and purchase grants. The tables and the student read path exist. Those admin tools are the next slice.

Native Android and iOS stay thin shells around this URL (Trusted Web Activity and a WebView). The installable site is the default.
