import { catalog } from '#lib/features/tests/server/attempt';
import { enabledOnly, examMap, tree } from '#lib/features/taxonomy/server/service';
import { getProfile } from '#lib/features/people/server/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	const [cards, exams, profile, tax] = await Promise.all([
		catalog(user.id),
		examMap(),
		getProfile(user.id).catch(() => null),
		tree().then(enabledOnly)
	]);
	const used = new Set(cards.map((c) => c.examId).filter(Boolean));
	return {
		cards,
		exams: [...exams.values()].filter((e) => used.has(e.id)).map((e) => ({ id: e.id, name: e.name })),
		categories: tax.categories.map((c) => ({
			slug: c.slug,
			name: c.name,
			description: c.description,
			exams: c.exams.map((e) => ({ id: e.id, name: e.name, slug: e.slug, description: e.description }))
		})),
		targetExamId: profile?.targetExamId ?? null,
		serverNow: new Date().toISOString()
	};
};
