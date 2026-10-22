import { notesForUser } from '#lib/features/notes/server/service';
import { tree } from '#lib/features/taxonomy/server/service';
import { requireUser } from '#lib/server/http';
import { z } from 'zod';
import type { PageServerLoad } from './$types';

const q = z.object({
	q: z.string().trim().max(100).optional().catch(undefined),
	exam: z.uuid().optional().catch(undefined),
	subject: z.uuid().optional().catch(undefined),
	tab: z.enum(['all', 'saved']).default('all').catch('all')
});

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	const f = q.parse(Object.fromEntries(event.url.searchParams));
	const [notes, all, t] = await Promise.all([
		notesForUser(u, { q: f.q || undefined, examId: f.exam, subjectId: f.subject, bookmarked: f.tab === 'saved' || undefined }),
		notesForUser(u),
		tree()
	]);
	// Only offer filters that match some note.
	const examIds = new Set(all.map((n) => n.examId));
	const exams = t.categories.flatMap((c) => c.exams).filter((e) => examIds.has(e.id));
	return {
		notes,
		tab: f.tab,
		savedCount: all.filter((n) => n.bookmarked).length,
		subjects: t.subjects.map((s) => ({ id: s.id, name: s.name })),
		names: Object.fromEntries([...exams.map((e) => [e.id, e.name]), ...t.subjects.map((s) => [s.id, s.name])]) as Record<string, string>
	};
};
