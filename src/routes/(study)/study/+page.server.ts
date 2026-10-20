import { redirect } from '@sveltejs/kit';
import { listCourses, listNotes } from '$lib/features/catalog/server/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const [courses, notes] = await Promise.all([listCourses(), listNotes()]);
	return { courses, notes };
};
