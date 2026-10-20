import { error, redirect } from '@sveltejs/kit';
import { completeLesson, courseDetail } from '$lib/features/catalog/server/service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const course = await courseDetail(locals.user.id, params.id);
	if (!course) error(404, 'Course not found');

	const flat = course.chapters.flatMap((chapter) =>
		chapter.lessons.map((lesson) => ({ ...lesson, chapterTitle: chapter.title }))
	);
	const index = flat.findIndex((lesson) => lesson.id === params.lessonId);
	const lesson = flat[index];
	if (!lesson) error(404, 'Lesson not found');

	return {
		courseId: course.id,
		courseTitle: course.title,
		chapterTitle: lesson.chapterTitle,
		index,
		total: flat.length,
		previous: flat[index - 1] ? { id: flat[index - 1].id, title: flat[index - 1].title } : null,
		next: flat[index + 1] ? { id: flat[index + 1].id, title: flat[index + 1].title } : null,
		lesson: {
			id: lesson.id,
			title: lesson.title,
			kind: lesson.kind,
			durationMinutes: lesson.durationMinutes,
			resourceUrl: lesson.resourceUrl,
			body: lesson.body,
			completed: lesson.completed
		}
	};
};

export const actions: Actions = {
	complete: async ({ locals, params, url }) => {
		if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
		await completeLesson(locals.user.id, params.lessonId);
		redirect(303, url.pathname);
	}
};
