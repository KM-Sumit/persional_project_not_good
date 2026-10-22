import { listProducts } from '#lib/features/billing/server/service';
import { continueLearning, coursesForUser } from '#lib/features/courses/server/service';
import { requireUser } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	const tab = event.url.searchParams.get('tab') === 'paid' || event.url.searchParams.get('tab') === 'mine' ? event.url.searchParams.get('tab')! : 'free';
	const [courses, cont, products] = await Promise.all([
		coursesForUser(u),
		continueLearning(u).catch(() => null),
		listProducts({ activeOnly: true }).catch(() => [])
	]);
	const price: Record<string, { productId: string; priceInr: number; mrpInr: number | null }> = {};
	for (const p of products) {
		if (p.kind !== 'course' || !p.courseId) continue;
		const cur = price[p.courseId];
		if (!cur || p.priceInr < cur.priceInr) price[p.courseId] = { productId: p.id, priceInr: p.priceInr, mrpInr: p.mrpInr };
	}
	return {
		tab,
		cont,
		price,
		mine: courses
			.filter((c) => c.progress.completed > 0 || c.id === cont?.course.id)
			.sort((a, b) => Number(b.id === cont?.course.id) - Number(a.id === cont?.course.id)),
		free: courses.filter((c) => !c.isPaid),
		paid: courses.filter((c) => c.isPaid)
	};
};
