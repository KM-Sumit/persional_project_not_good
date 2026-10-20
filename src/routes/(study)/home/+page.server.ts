import { redirect } from '@sveltejs/kit';
import {
	continueLearning,
	listBanners,
	listCourses,
	listNotes,
	listTests
} from '$lib/features/catalog/server/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const user = locals.user;
	const [banners, courses, notes, tests, learning] = await Promise.all([
		listBanners(),
		listCourses(),
		listNotes(),
		listTests(),
		continueLearning(user.id)
	]);
	return {
		user,
		banners,
		courses: courses.slice(0, 4),
		notes: notes.slice(0, 3),
		tests: tests.slice(0, 3),
		continueLearning: learning
	};
};
