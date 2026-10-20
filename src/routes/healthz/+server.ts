import type { RequestHandler } from './$types';
import { dbReady } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	const ok = await dbReady();
	return Response.json({ ok }, { status: ok ? 200 : 503 });
};
