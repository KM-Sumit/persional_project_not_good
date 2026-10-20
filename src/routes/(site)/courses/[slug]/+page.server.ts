import { error } from '@sveltejs/kit';
import { publicCourse } from '#lib/features/courses/server/service';
import { renderMarkdown } from '#lib/features/notes/server/markdown';
import { coursePrices, examHub } from '#lib/features/site/server/browse';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const course = await publicCourse(params.slug);
	if (!course) error(404, 'Course not found.');
	const [prices, hub] = await Promise.all([coursePrices([course.id]), examHub()]);
	const cat = hub.categories.find((c) => c.exams.some((e) => e.id === course.examId));
	const exam = cat?.exams.find((e) => e.id === course.examId);
	return {
		course,
		descriptionHtml: course.description ? renderMarkdown(course.description) : '',
		product: prices[course.id] ?? null,
		exam: cat && exam ? { name: exam.name, href: `/exams/${cat.slug}/${exam.slug}` } : null
	};
};
