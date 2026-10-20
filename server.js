import http from 'node:http';
import { handler } from './build/handler.js';

const NO_CACHE = /^\/(service-worker\.js|manifest\.webmanifest|_app\/version\.json)(\?|$)/;

const server = http.createServer((req, res) => {
	if (NO_CACHE.test(req.url ?? '')) {
		res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
		res.setHeader('CDN-Cache-Control', 'no-store');
	}
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, process.env.HOST ?? '0.0.0.0');
