import { redirect } from '@sveltejs/kit';
import { unreadCount } from '#lib/features/engage/server/service';
import { unreadAnswers } from '#lib/features/doubts/server/service';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent, url }) => {
	const { user } = await parent();
	if (!user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	// The bell counts inbox notices plus doubt answers not yet read.
	const [inbox, answers] = await Promise.all([unreadCount(user.id).catch(() => 0), unreadAnswers(user.id).catch(() => 0)]);
	return { user, unread: inbox + answers };
};
