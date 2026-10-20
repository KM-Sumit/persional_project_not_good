import { listCoursesAdmin } from '#lib/features/courses/server/service';
import { editorOptions, isPaidOf } from './options.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const p = url.searchParams;
	const q = p.get('q')?.trim() || undefined;
	const status = p.get('status');
	const [all, opts] = await Promise.all([
		listCoursesAdmin({ q, published: status === 'published' ? true : status === 'draft' ? false : undefined }),
		editorOptions()
	]);
	const exam = p.get('exam');
	const access = p.get('access');
	const examName = new Map(opts.exams.map((e) => [e.value, e.label]));
	const rows = all
		.map((c) => ({ ...c, paid: isPaidOf(c), examName: c.examId ? (examName.get(c.examId) ?? '') : '' }))
		.filter((c) => (!exam || c.examId === exam) && (!access || (access === 'paid') === c.paid));
	return { rows, exams: opts.exams, total: all.length };
};
