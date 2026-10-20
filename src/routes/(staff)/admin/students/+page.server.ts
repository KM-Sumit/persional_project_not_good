import { requireStaff } from '#lib/server/http';
import { listPeople } from '#lib/features/people/server/service';
import { addMembers, listBatches, listSessions } from '#lib/features/cohorts/server/service';
import { tree } from '#lib/features/taxonomy/server/service';
import type { PersonRow } from '#lib/features/people/schema';
import { peopleQuery, uuid } from './_query.server';
import { act, ids, str } from './_act.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const { url } = event;
	const exam = uuid(url.searchParams.get('exam'));
	const query = peopleQuery(url);
	const [sessions, batches, taxonomy] = await Promise.all([listSessions(), listBatches(), tree()]);

	// ponytail: the people service has no exam filter, so exam filtering walks pages (max 10) until 50 matches;
	// add `targetExamId` to peopleFilter when the student list outgrows that.
	let rows: PersonRow[] = [];
	let cursor = url.searchParams.get('cursor') || undefined;
	let nextCursor: string | null = null;
	for (let i = 0; i < (exam ? 10 : 1); i++) {
		const page = await listPeople({ ...query, cursor, limit: 50 });
		rows = rows.concat(exam ? page.items.filter((p) => p.targetExamId === exam) : page.items);
		nextCursor = page.nextCursor;
		if (!nextCursor || rows.length >= 50) break;
		cursor = nextCursor;
	}

	const examName = new Map(taxonomy.categories.flatMap((c) => c.exams.map((e) => [e.id, e.name] as const)));
	return {
		rows: rows.map((r) => ({ ...r, examName: r.targetExamId ? (examName.get(r.targetExamId) ?? '') : '' })),
		nextCursor,
		sessions,
		batches,
		exams: taxonomy.categories.flatMap((c) => c.exams.map((e) => ({ value: e.id, label: e.name, group: c.name }))),
		exportHref: `/admin/students/export.csv?${url.searchParams.toString()}`
	};
};

export const actions: Actions = {
	addToBatch: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const list = ids(d);
		return act(async () => {
			await addMembers(str(d, 'batchId'), list);
			return list.length;
		}, `Added ${list.length} to the batch`);
	}
};
