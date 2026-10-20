import { dbReady } from '#lib/server/db';
import type { RequestHandler } from './$types';

// 200 only when the app can reach the database; used by the Docker HEALTHCHECK for zero-downtime rollouts.
export const GET: RequestHandler = async () =>
	(await dbReady()) ? new Response('ok') : new Response('db unavailable', { status: 503 });
