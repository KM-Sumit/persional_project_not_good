# UCI rebuild

Online-first exam-prep PWA. The Expo prototype is preserved under `legacy/` until this app covers the same jobs.

## Decisions

- Stack is SvelteKit Pro Max: Bun, Svelte 5 runes, adapter-node, Drizzle, Postgres, Valkey, Zod, Tailwind v4, Lucide.
- Rendering is SSR. Attempts are server-timed, so the app is not offline-first. The service worker caches the shell and static assets only. HTML for signed-in pages is not cached.
- Sign-in is Google, server-side code flow with PKCE. Sessions are our own httpOnly cookie (sha256 in Postgres). `GOOGLE_OAUTH_MOCK=1` is a dev-only account chooser.
- Admins are Google emails in `ADMIN_EMAILS`. Everyone else is a student.
- Files (PDFs, banners, thumbnails, lesson files, avatars, AI source PDFs) go to a private Cloudflare R2 bucket. The app issues short-lived signed URLs. Postgres stores the object key, never a public URL.
- AI question drafts go through OpenRouter. Missing key: the generator refuses with a clear message, it does not invent stub questions into a live test.
- Marks are integer milli-marks (1000 = 1 mark) so negative marking does not use floats.
- Claymorphism was rejected. The palette search matched children's education. This product is a timed exam for adults. Ink, warm paper, Literata for questions, Inter for chrome.
- Paid access stays admin-granted. There is no payment gateway in the prototype, so none is added.
- Broadcasts are an in-app inbox. The prototype only logged them.

## Checklist

- [ ] Move the prototype to `legacy/` and scaffold SvelteKit
- [ ] Infra: env, db, cache, http, R2, compose, schema, migrate
- [ ] Auth: Google start, callback, mock, session, hooks
- [ ] Design shell: tokens, tab bar, sign-in, student home, courses, notes, tests
- [ ] Attempt loop: start, answer, submit, result
- [ ] Admin home gated by role
- [ ] Seed, check, test, build, and drive the attempt in the browser
