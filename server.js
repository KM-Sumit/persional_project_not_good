// Production entry: the SvelteKit node handler, plus cache headers that keep app updates instant.
// service-worker.js, the manifest and the version file must never be cached by Cloudflare or browsers,
// or users keep running an old app (and an old worker) for hours after a deploy.
import http from 'node:http';
import { handler } from './build/handler.js';

// Password-reset links and the Google redirect URI are built from ORIGIN; refuse to boot without it.
if (process.env.NODE_ENV === 'production' && !process.env.ORIGIN) {
	console.error('[boot] ORIGIN is not set (e.g. https://uci.divyanshshukla.com)');
	process.exit(1);
}

const NO_CACHE = /^\/(service-worker\.js|manifest\.webmanifest|_app\/version\.json)(\?|$)/;

http
	.createServer((req, res) => {
		if (NO_CACHE.test(req.url ?? '')) {
			res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
			res.setHeader('CDN-Cache-Control', 'no-store'); // Cloudflare honours this for the edge
		}
		handler(req, res, () => {
			res.statusCode = 404;
			res.end('Not found');
		});
	})
	.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '0.0.0.0', () =>
		console.log(`[boot] listening on ${process.env.PORT ?? 3000}`)
	);
