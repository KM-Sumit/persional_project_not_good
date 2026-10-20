/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { dev, version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { resolve } from '$app/paths';
import { self } from '$app/service-worker';

const CACHE = `uci-${version}-2`;

const PRECACHE = [
	...new Set(
		[...immutable, ...assets].map((item) => resolve(item.path.replace(/^\//, '')))
	)
];

const ASSET_DESTINATIONS = new Set(['font', 'image', 'script', 'style', 'manifest']);

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
			await self.clients.claim();
		})()
	);
});

self.addEventListener('message', (event) => {
	if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const networkOnly = (request: Request, url: URL) => {
	const path = url.pathname;
	return (
		request.mode === 'navigate' ||
		request.destination === 'document' ||
		path === '/service-worker.js' ||
		path === '/api' ||
		path.startsWith('/api/') ||
		path === '/healthz' ||
		path.startsWith('/healthz/') ||
		path.endsWith('/__data.json') ||
		path.endsWith('.html__data.json')
	);
};

const storable = (response: Response) => {
	if (!response.ok || response.type !== 'basic') return false;
	const type = response.headers.get('content-type') ?? '';
	if (type.includes('text/html') || type.includes('application/json')) return false;
	const control = response.headers.get('cache-control') ?? '';
	return !/\bno-store\b|\bprivate\b/.test(control);
};

self.addEventListener('fetch', (event) => {
	if (dev) return;
	const request = event.request;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	if (url.pathname.startsWith('/@') || url.searchParams.has('token')) return;
	if (networkOnly(request, url)) return;

	const asset = PRECACHE.includes(url.pathname) || ASSET_DESTINATIONS.has(request.destination);
	if (!asset) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const hit = await cache.match(request);
			if (hit) return hit;

			const response = await fetch(request);
			if (storable(response)) void cache.put(request, response.clone());
			return response;
		})()
	);
});
