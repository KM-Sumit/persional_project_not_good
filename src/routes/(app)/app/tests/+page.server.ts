import { catalog } from '#lib/features/tests/server/attempt';
import { examMap } from '#lib/features/taxonomy/server/service';
import { getProfile } from '#lib/features/people/server/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	const [cards, exams, profile] = await Promise.all([catalog(user.id), examMap(), getProfile(user.id).catch(() => null)]);
	const used = new Set(cards.map((c) => c.examId).filter(Boolean));
	return {
		cards,
		exams: [...exams.values()].filter((e) => used.has(e.id)).map((e) => ({ id: e.id, name: e.name })),
		targetExamId: profile?.targetExamId ?? null,
		serverNow: new Date().toISOString()
	};
};
