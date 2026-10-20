import { error } from '@sveltejs/kit';
import { coursesForUser } from '#lib/features/courses/server/service';
import { notesForUser } from '#lib/features/notes/server/service';
import { enabledOnly, tree } from '#lib/features/taxonomy/server/service';
import { catalog } from '#lib/features/tests/server/attempt';
import { requireUser } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	const t = enabledOnly(await tree());
	const cat = t.categories.find((c) => c.exams.some((e) => e.slug === event.params.exam));
	const exam = cat?.exams.find((e) => e.slug === event.params.exam);
	if (!cat || !exam) error(404, 'Exam not found.');
	const [tests, courses, notes] = await Promise.all([catalog(u.id), coursesForUser(u), notesForUser(u, { examId: exam.id })]);
	return {
		exam: { ...exam, categoryName: cat.name },
		isTarget: u.targetExamId === exam.id,
		tests: tests.filter((x) => x.examId === exam.id && x.window !== 'ended'),
		courses: courses.filter((c) => c.examId === exam.id),
		notes
	};
};
