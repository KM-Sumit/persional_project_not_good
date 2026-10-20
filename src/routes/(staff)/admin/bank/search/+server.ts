import { json } from '@sveltejs/kit';
import { searchQuestions } from '#lib/features/bank/server/service';
import { requireStaff, toHttp } from '#lib/server/http';
import type { RequestHandler } from './$types';

/** Bank search for client pickers (test wizard, add-from-bank): ?q, topic, difficulty, moduleId, cursor. */
export const GET: RequestHandler = async (event) => {
	requireStaff(event);
	const sp = event.url.searchParams;
	try {
		return json(
			await searchQuestions({
				q: sp.get('q') || undefined,
				topic: sp.get('topic') || undefined,
				difficulty: (sp.get('difficulty') || undefined) as 'easy' | undefined,
				moduleId: sp.get('moduleId') || undefined,
				cursor: sp.get('cursor'),
				limit: 20
			})
		);
	} catch (e) {
		toHttp(e);
	}
};
