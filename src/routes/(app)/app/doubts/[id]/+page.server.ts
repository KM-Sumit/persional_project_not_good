import { getMine } from '#lib/features/doubts/server/service';
import { requireUser, toHttp } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	try {
		return { doubt: await getMine(u.id, event.params.id), now: new Date().toISOString() };
	} catch (e) {
		toHttp(e);
	}
};
