import { publicCatalog } from '#lib/features/courses/server/service';
import { coursePrices, courseThumbs, examHub } from '#lib/features/site/server/browse';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [courses, hub] = await Promise.all([publicCatalog(), examHub()]);
	const exams = hub.categories.flatMap((c) => c.exams.map((e) => ({ id: e.id, name: e.name, slug: e.slug })));
	const [prices, thumbs] = await Promise.all([coursePrices(courses.map((c) => c.id)), courseThumbs(courses.map((c) => c.slug))]);
	return { courses, exams, prices, thumbs };
};
