import { dailyFeed } from '#lib/features/posts/server/service';
import { requireUser } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	return { feed: await dailyFeed(u.id, event.url.searchParams.get('d')) };
};
