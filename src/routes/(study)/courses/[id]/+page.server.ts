import { error, redirect } from '@sveltejs/kit';
import { courseDetail } from '$lib/features/catalog/server/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const lesson = url.searchParams.get('lesson');
	if (lesson) redirect(303, `/courses/${params.id}/lessons/${lesson}`);
	const course = await courseDetail(locals.user.id, params.id);
	if (!course) error(404, 'Course not found');
	return course;
};
