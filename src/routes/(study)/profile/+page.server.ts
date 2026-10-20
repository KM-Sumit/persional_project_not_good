import { redirect } from '@sveltejs/kit';
import { listInbox, markRead } from '$lib/features/inbox/server/service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const user = locals.user;
	return { user, inbox: await listInbox(user.id) };
};

export const actions: Actions = {
	read: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
		const notificationId = String((await request.formData()).get('notificationId') ?? '');
		if (!notificationId) return { read: false };
		await markRead(locals.user.id, notificationId);
		return { read: true };
	}
};
