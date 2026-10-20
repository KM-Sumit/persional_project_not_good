import { fail, redirect } from '@sveltejs/kit';
import { recentResults, sendNotice, stats } from '$lib/features/admin/server/service';
import { noticeSchema } from '$lib/features/auth/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const [summary, results] = await Promise.all([stats(), recentResults()]);
	return { stats: summary, results };
};

export const actions: Actions = {
	send: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
		const formData = await request.formData();
		const title = formData.get('title');
		const body = formData.get('body');
		const parsed = noticeSchema.safeParse({ title, body });
		if (!parsed.success) {
			return fail(400, {
				message: parsed.error.issues[0]?.message ?? 'Check the notice',
				title: String(title ?? ''),
				body: String(body ?? '')
			});
		}
		await sendNotice(locals.user.id, parsed.data.title, parsed.data.body);
		return { sent: true };
	}
};
