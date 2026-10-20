import { error } from '@sveltejs/kit';
import { examHub } from '#lib/features/site/server/browse';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const hub = await examHub();
	const category = hub.categories.find((c) => c.slug === params.category);
	if (!category) error(404, 'Exam category not found.');
	return { category, categories: hub.categories.map(({ id, name, slug }) => ({ id, name, slug })), counts: hub.counts };
};
