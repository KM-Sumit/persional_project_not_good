import { requireStaff } from '#lib/server/http';
import {
	createBatch,
	createSession,
	listBatches,
	listSessions,
	rollover,
	setCurrentSession
} from '#lib/features/cohorts/server/service';
import { tree } from '#lib/features/taxonomy/server/service';
import { act, str } from '../students/_act.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const sessions = await listSessions();
	const want = event.url.searchParams.get('session');
	const session = sessions.find((s) => s.id === want) ?? sessions.find((s) => s.isCurrent) ?? sessions[0] ?? null;
	const [batches, taxonomy] = await Promise.all([
		session ? listBatches({ sessionId: session.id, includeArchived: true }) : Promise.resolve([]),
		tree()
	]);
	return {
		sessions,
		session,
		batches,
		exams: taxonomy.categories.flatMap((c) => c.exams.map((e) => ({ value: e.id, label: e.name, group: c.name })))
	};
};

export const actions: Actions = {
	createSession: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => createSession({ name: str(d, 'name'), startsOn: str(d, 'startsOn'), endsOn: str(d, 'endsOn') }), 'Session created');
	},
	setCurrent: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => setCurrentSession(str(d, 'id')), 'Current session changed');
	},
	createBatch: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => createBatch({ sessionId: str(d, 'sessionId'), name: str(d, 'name'), examId: str(d, 'examId') || null }), 'Batch created');
	},
	rollover: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => rollover(str(d, 'from'), str(d, 'to')), (r: string[]) => `Copied ${r.length} ${r.length === 1 ? 'batch' : 'batches'}`);
	}
};
