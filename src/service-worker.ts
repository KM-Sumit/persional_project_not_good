/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Offline-first shell for a server-rendered app (routing rules: src/lib/components/pwa/cache-route.ts).
// - install: precache every hashed bundle + static file of this build, so the app opens instantly and offline.
//   The new worker then WAITS; UpdatePrompt posts SKIP_WAITING when the user taps Update.
// - pages: network first (fresh data, auth checks), the last good copy when offline, else /offline.html.
//   Live quiz/answers/live board/auth/billing/POSTs never touch a cache.
// - any auth request (logout, login, ...) deletes the cached pages: the next person never sees them.
// - "Save offline" items live in the SAVED bucket (kept across builds and sign-outs), served cache-first.
// - push: shows the notification; tapping it focuses an open tab (navigating it) or opens the url.
import { assets, immutable } from '$app/manifest';
import { version, dev } from '$app/env';
import { self as sw } from '$app/service-worker';
import { AUTH, SAVED, cacheRoute } from './lib/components/pwa/cache-route';

const CACHE = `app-${version}`;
const PAGES = `pages-${version}`; // per build: old pages point at old bundles that are gone
const FONTS = 'fonts'; // Google Fonts: same URL = same bytes, so it survives builds
const OFFLINE = '/offline.html';
const PRECACHE = [...immutable, ...assets].map((f) => `/${f.path}`).filter((p) => p !== '/sw.js' && !p.startsWith('/screenshots/'));
const precached = new Set(PRECACHE);

sw.addEventListener('install', (event) => {
	// Per-asset: one missing file must not abort the whole install (addAll is atomic).
	event.waitUntil(
		caches.open(CACHE).then((c) => Promise.all(PRECACHE.map((url) => c.add(url).catch(() => undefined))))
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key !== CACHE && key !== PAGES && key !== FONTS && key !== SAVED) await caches.delete(key);
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('message', (event) => {
	if (event.data === 'SKIP_WAITING') sw.skipWaiting();
});

async function page(req: Request): Promise<Response> {
	try {
		const res = await fetch(req);
		// Only plain 200s: never redirects (sign-in bounces) or errors.
		if (res.status === 200 && res.type === 'basic') {
			const copy = res.clone();
			caches.open(PAGES).then((c) => c.put(req, copy)).catch(() => {});
		}
		return res;
	} catch {
		const hit = await caches.match(req, { cacheName: PAGES, ignoreVary: true });
		if (hit) return hit;
		// '/' only redirects a signed-in user to their home (never cached): open the home they last saw.
		if (req.mode === 'navigate' && new URL(req.url).pathname === '/')
			for (const home of ['/app', '/admin']) if (await caches.match(home, { cacheName: PAGES, ignoreVary: true })) return Response.redirect(home, 302);
		if (req.mode === 'navigate') return (await caches.match(OFFLINE, { cacheName: CACHE })) ?? Response.error();
		return Response.error();
	}
}

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = new URL(req.url);
	const route = cacheRoute(req.method, url, sw.location.origin, precached);
	if (route === 'saved') return event.respondWith(caches.match(req, { cacheName: SAVED, ignoreSearch: true, ignoreVary: true }).then((hit) => hit ?? fetch(req)));
	if (dev) return; // never touch Vite's module graph
	if (url.origin === sw.location.origin && AUTH.test(url.pathname)) event.waitUntil(caches.delete(PAGES));

	if (route === 'precache') event.respondWith(caches.match(req, { cacheName: CACHE }).then((hit) => hit ?? fetch(req)));
	else if (route === 'page') event.respondWith(page(req));
	else if (route === 'font')
		event.respondWith(
			caches.match(req, { cacheName: FONTS }).then(
				(hit) =>
					hit ??
					fetch(req).then((res) => {
						if (res.ok || res.type === 'opaque') {
							const copy = res.clone();
							caches.open(FONTS).then((c) => c.put(req, copy)).catch(() => {});
						}
						return res;
					})
			)
		);
	else if (req.mode === 'navigate' && req.method === 'GET' && url.origin === sw.location.origin)
		// Never-cached pages (live quiz, login, ...) still get the offline screen instead of the browser's error.
		event.respondWith(fetch(req).catch(async () => (await caches.match(OFFLINE, { cacheName: CACHE })) ?? Response.error()));
});

sw.addEventListener('push', (event) => {
	let p: { title?: string; body?: string; url?: string } = {};
	try {
		p = event.data?.json() ?? {};
	} catch {
		p = { body: event.data?.text() };
	}
	event.waitUntil(
		sw.registration.showNotification(p.title || 'UCI', { body: p.body ?? '', icon: '/brand/uci.png', data: { url: p.url || '/app' } })
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL((event.notification.data as { url?: string } | null)?.url || '/app', sw.location.origin);
	if (target.origin !== sw.location.origin) return; // only our own pages
	event.waitUntil(
		(async () => {
			const tabs = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const tab = tabs.find((c) => new URL(c.url).origin === target.origin);
			if (tab) return (await tab.focus()).navigate(target.href);
			return sw.clients.openWindow(target.href);
		})()
	);
});
