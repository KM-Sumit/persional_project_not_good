import { error } from '@sveltejs/kit';
import { examPage } from '#lib/features/site/server/browse';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const data = await examPage(params.category, params.exam);
	if (!data) error(404, 'Exam not found.');
	return data;
};
