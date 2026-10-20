import { requireStaff } from '#lib/server/http';
import { deleteNotification, send, sentList } from '#lib/features/engage/server/service';
import { listBatches } from '#lib/features/cohorts/server/service';
import { act, str } from '../students/_act.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const [sent, batches] = await Promise.all([sentList(event.url.searchParams.get('cursor'), 30), listBatches()]);
	return {
		sent: sent.items,
		next: sent.next,
		batches: batches.map((b) => ({ value: b.id, label: `${b.name}`, hint: `${b.memberCount} students`, group: b.sessionName }))
	};
};

export const actions: Actions = {
	send: async (event) => {
		const me = requireStaff(event);
		const d = await event.request.formData();
		const batchId = str(d, 'audience') === 'batch' ? str(d, 'batchId') || null : null;
		return act(() => send({ title: str(d, 'title'), body: str(d, 'body'), href: str(d, 'href') || null, batchId }, me.id), 'Announcement sent');
	},
	delete: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => deleteNotification(str(d, 'id')), 'Announcement deleted');
	}
};
