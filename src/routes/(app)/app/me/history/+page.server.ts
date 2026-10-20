import { history } from '#lib/features/tests/server/attempt';
import { requireUser } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	return history(u.id, { cursor: event.url.searchParams.get('cursor'), limit: 30 });
};
