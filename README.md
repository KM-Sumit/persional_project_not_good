# UCI Exam Prep

Online exam-prep app for SSC, railways, banking, and teaching. Students take timed tests, read notes, and move through courses. Admins are Google accounts listed in `ADMIN_EMAILS`.

The Expo prototype is in `legacy/`. This app replaces it.

## Run

```sh
bun install
cp .env.example .env
bun run db:up
bun run db:generate   # first time, after schema changes
bun run db:migrate
bun run db:seed
bun run dev           # http://localhost:5173
```

With `GOOGLE_OAUTH_MOCK=1` (development only), the sign-in page offers a student and an admin. Production ignores that flag.

## Stack

Bun, SvelteKit, Svelte 5, Drizzle, Postgres, Valkey, Tailwind, Lucide. Files go to a private Cloudflare R2 bucket when `R2_*` is set. Question drafting uses OpenRouter when `OPENROUTER_API_KEY` is set.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DESIGN.md](docs/DESIGN.md).
