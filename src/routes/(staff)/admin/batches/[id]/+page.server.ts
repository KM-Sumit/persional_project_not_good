import { error } from '@sveltejs/kit';
import { DomainError, requireStaff } from '#lib/server/http';
import { addMembers, getBatch, listBatches, listMembers, moveMembers, regenerateJoinCode, removeMembers, setBatchArchived, updateBatch } from '#lib/features/cohorts/server/service';
import { listPeople } from '#lib/features/people/server/service';
import { send, sentList } from '#lib/features/engage/server/service';
import { tree } from '#lib/features/taxonomy/server/service';
import { act, ids, on, str } from '../../students/_act.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const id = event.params.id;
	const batch = await getBatch(id).catch((e) => {
		if (e instanceof DomainError) error(e.status, e.message);
		throw e;
	});
	const q = event.url.searchParams.get('q')?.trim() ?? '';
	const [members, batches, sent, found, taxonomy] = await Promise.all([
		listMembers(id),
		listBatches({ sessionId: batch.sessionId }),
		sentList(null, 50),
		q ? listPeople({ q, role: 'student', limit: 10 }) : Promise.resolve(null),
		tree()
	]);
	const inBatch = new Set(members.map((m) => m.id));
	return {
		batch,
		members,
		q,
		found: found?.items.filter((p) => !inBatch.has(p.id)) ?? null,
		exams: taxonomy.categories.flatMap((c) => c.exams.map((e) => ({ value: e.id, label: e.name, group: c.name }))),
		targets: batches.filter((b) => b.id !== id).map((b) => ({ value: b.id, label: b.name })),
		// ponytail: batch announcements come from the latest 50 sent; add a batchId filter to sentList when that hides older ones.
		announcements: sent.items.filter((n) => n.batchId === id)
	};
};

export const actions: Actions = {
	update: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => updateBatch(event.params.id, { name: str(d, 'name'), examId: str(d, 'examId') || null }), 'Batch saved');
	},
	archive: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const a = on(d, 'archived');
		return act(() => setBatchArchived(event.params.id, a), a ? 'Batch archived' : 'Batch restored');
	},
	newCode: async (event) => {
		requireStaff(event);
		return act(() => regenerateJoinCode(event.params.id), 'New join code made');
	},
	add: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const list = ids(d);
		return act(() => addMembers(event.params.id, list), list.length === 1 ? 'Student added' : `${list.length} students added`);
	},
	remove: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const list = ids(d);
		return act(() => removeMembers(event.params.id, list), list.length === 1 ? 'Student removed' : `${list.length} students removed`);
	},
	move: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const list = ids(d);
		return act(() => moveMembers(event.params.id, str(d, 'to'), list), `Moved ${list.length}`);
	},
	announce: async (event) => {
		const me = requireStaff(event);
		const d = await event.request.formData();
		return act(() => send({ title: str(d, 'title'), body: str(d, 'body'), href: str(d, 'href') || null, batchId: event.params.id }, me.id), 'Announcement sent');
	}
};
