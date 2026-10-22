import { requireStaff } from '#lib/server/http';
import { deleteNotification, send, sentList } from '#lib/features/engage/server/service';
import { listBatches } from '#lib/features/cohorts/server/service';
import { createPost, deleteJobAlertBySlug } from '#lib/features/posts/server/service';
import { istDate } from '#lib/features/posts/format';
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
		const title = str(d, 'title');
		const body = str(d, 'body');
		const batchId = str(d, 'audience') === 'batch' ? str(d, 'batchId') || null : null;
		let href = str(d, 'href') || null;
		if (!batchId) {
			const post = await createPost({ kind: 'job_alert', title, body: body.trim() || title, publishedOn: istDate(), published: true });
			href ??= `/jobs/${post.slug}`;
		}
		return act(() => send({ title, body, href, batchId }, me.id), 'Announcement sent');
	},
	delete: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(async () => {
			const row = await deleteNotification(str(d, 'id'));
			const slug = row?.href?.match(/^\/jobs\/([^/?#]+)$/)?.[1];
			if (slug) await deleteJobAlertBySlug(decodeURIComponent(slug));
		}, 'Announcement deleted');
	}
};
