import { continueLearning, coursesForUser } from '#lib/features/courses/server/service';
import { examMap } from '#lib/features/taxonomy/server/service';
import { requireUser } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	const [courses, cont, exams] = await Promise.all([coursesForUser(u), continueLearning(u).catch(() => null), examMap()]);
	const examIds = [...new Set(courses.map((c) => c.examId).filter((x): x is string => !!x))];
	const asked = event.url.searchParams.get('exam');
	// Default to the student's target exam when the catalog has courses for it.
	const exam = asked === 'all' ? null : (asked ?? (u.targetExamId && examIds.includes(u.targetExamId) ? u.targetExamId : null));
	const examName = (id: string | null) => (id ? (exams.get(id)?.name ?? null) : null);
	return {
		mine: courses
			.filter((c) => c.progress.completed > 0 || c.id === cont?.course.id)
			.sort((a, b) => Number(b.id === cont?.course.id) - Number(a.id === cont?.course.id)),
		catalog: courses.filter((c) => !exam || c.examId === exam).map((c) => ({ ...c, examName: examName(c.examId) })),
		chips: examIds.map((id) => ({ id, name: examName(id) ?? 'Exam' })),
		exam,
		cont
	};
};
