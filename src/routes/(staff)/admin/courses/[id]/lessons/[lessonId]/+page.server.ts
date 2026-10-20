import { error, redirect } from '@sveltejs/kit';
import { deleteLesson, getCourseAdmin, reorderLessons, updateLesson } from '#lib/features/courses/server/service';
import { requireStaff, toHttp } from '#lib/server/http';
import { attempt, str } from '../../../options.server';
import { lessonFields } from '../../lesson.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const course = await getCourseAdmin(params.id).catch(toHttp);
	const lesson = course.chapters.flatMap((c) => c.lessons).find((l) => l.id === params.lessonId);
	if (!lesson) error(404, 'Lesson not found.');
	return {
		course: { id: course.id, title: course.title },
		lesson,
		chapters: course.chapters.map((c) => ({ value: c.id, label: c.title, ids: c.lessons.map((l) => l.id) }))
	};
};

export const actions: Actions = {
	save: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		const { id, lessonId } = event.params;
		return attempt(async () => {
			const { youtubeId: _, ...input } = await lessonFields(fd);
			await updateLesson(lessonId, input);
			// Moving to another chapter appends it there.
			const to = str(fd, 'chapterId');
			const course = await getCourseAdmin(id);
			const target = course.chapters.find((c) => c.id === to);
			if (target && !target.lessons.some((l) => l.id === lessonId)) await reorderLessons(to, [...target.lessons.map((l) => l.id), lessonId]);
			return { message: 'Lesson saved' };
		});
	},
	delete: async (event) => {
		requireStaff(event);
		await deleteLesson(event.params.lessonId).catch(toHttp);
		redirect(303, `/admin/courses/${event.params.id}`);
	}
};
