import { error } from '@sveltejs/kit';
import { DomainError, requireStaff } from '#lib/server/http';
import { getProfile, setSuspended } from '#lib/features/people/server/service';
import { addMembers, listBatches, removeMembers } from '#lib/features/cohorts/server/service';
import { coursesForUser } from '#lib/features/courses/server/service';
import { addGrant, listTests } from '#lib/features/tests/server/service';
import { history } from '#lib/features/tests/server/attempt';
import { tree } from '#lib/features/taxonomy/server/service';
import { act, on, str } from '../_act.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const id = event.params.id;
	const profile = await getProfile(id).catch((e) => {
		if (e instanceof DomainError) error(e.status, e.message);
		throw e;
	});
	const [attempts, courses, batches, gated, taxonomy] = await Promise.all([
		history(id, { limit: 50 }),
		coursesForUser({ id, role: profile.role }),
		listBatches(),
		listTests({ status: 'published', limit: 100 }),
		tree()
	]);
	const exam = taxonomy.categories.flatMap((c) => c.exams).find((e) => e.id === profile.targetExamId);
	return {
		profile,
		examName: exam?.name ?? null,
		attempts: attempts.items,
		courses: courses.filter((c) => c.progress.completed > 0),
		batches: batches.filter((b) => !profile.batches.some((m) => m.id === b.id)).map((b) => ({ value: b.id, label: b.name, group: b.sessionName })),
		tests: gated.items.filter((t) => t.access !== 'open').map((t) => ({ value: t.id, label: t.title, hint: t.access === 'paid' ? 'Paid' : 'Password' })),
		canSuspend: event.locals.user!.id !== id && (event.locals.user!.role === 'admin' || profile.role === 'student')
	};
};

export const actions: Actions = {
	suspend: async (event) => {
		const me = requireStaff(event);
		const d = await event.request.formData();
		const s = on(d, 'suspended');
		return act(() => setSuspended(me, event.params.id, s), s ? 'Student suspended' : 'Student restored');
	},
	addBatch: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => addMembers(str(d, 'batchId'), [event.params.id]), 'Added to batch');
	},
	removeBatch: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => removeMembers(str(d, 'batchId'), [event.params.id]), 'Removed from batch');
	},
	grant: async (event) => {
		const me = requireStaff(event);
		const d = await event.request.formData();
		return act(() => addGrant(str(d, 'testId'), { userId: event.params.id, note: str(d, 'note') }, me.id), 'Test access granted');
	}
};
