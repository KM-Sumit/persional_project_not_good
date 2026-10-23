import { catalog } from '#lib/features/tests/server/attempt';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	const cards = await catalog(user.id);
	return {
		tests: cards
			.filter((c) => c.access === 'password')
			.map((c) => ({
				id: c.id,
				title: c.title,
				questionCount: c.questionCount,
				durationMin: c.durationMin,
				inProgressAttemptId: c.inProgressAttemptId
			}))
	};
};
