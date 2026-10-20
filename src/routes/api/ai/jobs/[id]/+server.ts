import { json } from '@sveltejs/kit';
import { getJob } from '#lib/features/ai/server/service';
import { requireStaff, toHttp } from '#lib/server/http';
import type { RequestHandler } from './$types';

/** Job status for the review screen's poll. */
export const GET: RequestHandler = async (event) => {
	requireStaff(event);
	try {
		return json(await getJob(event.params.id), { headers: { 'cache-control': 'no-store' } });
	} catch (e) {
		toHttp(e);
	}
};
