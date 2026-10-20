import { requireUser, toHttp } from '#lib/server/http';
import { classForUser } from '#lib/features/live/server/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const live = await classForUser(user, event.params.id).catch(toHttp);
	return { live, serverNow: new Date().toISOString() };
};
