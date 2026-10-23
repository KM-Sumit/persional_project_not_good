import { redirect } from '@sveltejs/kit';
import { unreadCount } from '#lib/features/engage/server/service';
import { unreadAnswers } from '#lib/features/doubts/server/service';
import { openPasswordAttempt } from '#lib/features/tests/server/attempt';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent, url }) => {
	const { user } = await parent();
	if (!user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	// The bell counts inbox notices plus doubt answers not yet read.
	const [inbox, answers, pt] = await Promise.all([
		unreadCount(user.id).catch(() => 0),
		unreadAnswers(user.id).catch(() => 0),
		openPasswordAttempt(user.id).catch(() => null)
	]);
	return { user, unread: inbox + answers, pt, serverNow: new Date().toISOString() };
};
