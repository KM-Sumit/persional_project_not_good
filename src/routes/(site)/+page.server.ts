import { publicCatalog } from '#lib/features/courses/server/service';
import { coursePrices, courseThumbs, examHub, nextLiveTest } from '#lib/features/site/server/browse';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [live, hub, courses] = await Promise.all([nextLiveTest(), examHub(), publicCatalog()]);
	const shown = courses.slice(0, 6);
	const [prices, thumbs] = await Promise.all([coursePrices(shown.map((c) => c.id)), courseThumbs(shown.map((c) => c.slug))]);
	return { live, hub, courses: shown, prices, thumbs, courseTotal: courses.length };
};
