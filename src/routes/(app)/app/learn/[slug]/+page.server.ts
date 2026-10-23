import { coursePaywall, stripLocked } from '#lib/features/billing/server/paywall';
import { courseForUser } from '#lib/features/courses/server/service';
import { examMap } from '#lib/features/taxonomy/server/service';
import { listTests } from '#lib/features/tests/server/service';
import { requireUser, toHttp } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	const page = await courseForUser(u, event.params.slug).catch(toHttp);
	const [exams, paywall, tests] = await Promise.all([
		page.course.examId ? examMap() : null,
		coursePaywall(u.id, page.course),
		listTests({ courseId: page.course.id, status: 'published', limit: 50 })
	]);
	const examName = page.course.examId ? (exams?.get(page.course.examId)?.name ?? null) : null;
	return {
		...page,
		course: paywall.locked ? stripLocked(page.course) : page.course,
		paywall,
		examName,
		tests: tests.items.map((t) => ({ id: t.id, title: t.title, questionCount: t.questionCount, durationMin: t.durationMin }))
	};
};
