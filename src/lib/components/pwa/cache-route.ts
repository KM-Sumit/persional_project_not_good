// Pure fetch-routing decision for src/service-worker.ts (unit-tested in cache-route.test.ts).
//   'network'  — the SW stays out of it; never cached (POSTs, live, auth, billing, APIs, streams, exports)
//   'precache' — a hashed bundle or static file of this build: cache first
//   'page'     — a read-only page or its __data.json: network first, last good copy when offline
//   'font'     — Google Fonts CSS + files: cache first, kept across builds
//   'saved'    — a note page or PDF the user saved for offline (/app/downloads/{note,file}/...): served from the
//                SAVED bucket first (kept across builds and sign-outs), else network without caching
// 'page' entries are user-specific; the SW deletes them on any auth request (logout, login, ...).

export type CacheRoute = 'network' | 'precache' | 'page' | 'font' | 'saved';

/** Cache Storage bucket for "Save offline" items. Not versioned: it must survive app updates. */
export const SAVED = 'offline-saved';
export const SAVED_PATH = /^\/app\/downloads\/(note|file)\/[^/]+$/;

// The exam screen and answers, checkout and billing, auth, APIs, /_app/version.json (update check),
// health checks, dev modules and CSV exports never touch a cache.
const NEVER =
	/^\/(api|_app|healthz|login|logout|auth|src|@vite|@fs|@id|node_modules|\.svelte-kit)(\/|$)|^\/app\/tests\/[^/]+\/attempt(\/|$)|^\/app\/(checkout|me\/billing)(\/|$)|^\/admin\/(payments|products)(\/|$)|\.csv$/;

/** Requests to these clear the user-specific page cache: a different person may sign in next. */
export const AUTH = /^\/(login|logout|auth)(\/|$)/;

export function cacheRoute(method: string, url: URL, origin: string, precached: Set<string>): CacheRoute {
	if (method !== 'GET') return 'network';
	if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') return 'font';
	if (url.origin !== origin) return 'network';
	if (precached.has(url.pathname)) return 'precache';
	if (SAVED_PATH.test(url.pathname)) return 'saved';
	// SvelteKit client navigations fetch <page>/__data.json: route it like the page itself.
	const path = url.pathname.replace(/\/__data\.json$/, '') || '/';
	return NEVER.test(path) ? 'network' : 'page';
}
