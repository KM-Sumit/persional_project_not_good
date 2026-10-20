import { examMap } from '#lib/features/taxonomy/server/service';
import { asFilter } from '#lib/features/doubts/schema';
import { openCount, queue } from '#lib/features/doubts/server/service';
import { requireStaff } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const p = event.url.searchParams;
	// No ?status= means the work queue (open); ?status=all shows everything.
	const status = p.get('status') === 'all' ? 'all' : (asFilter(p.get('status')) ?? 'open');
	const [page, open, exams] = await Promise.all([
		queue({ filter: status === 'all' ? null : status, examId: p.get('exam'), q: p.get('q'), cursor: p.get('cursor') }),
		openCount(),
		examMap()
	]);
	const examName = Object.fromEntries([...exams].map(([id, e]) => [id, e.name]));
	return {
		status,
		open,
		doubts: page.items.map((d) => ({ ...d, exam: d.examId ? (examName[d.examId] ?? null) : null })),
		next: page.next,
		examOptions: [...exams.values()].map((e) => ({ value: e.id, label: e.name })),
		now: new Date().toISOString()
	};
};
