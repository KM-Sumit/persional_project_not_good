import { listPostsAdmin, setPostPublished } from '#lib/features/posts/server/service';
import { POST_KINDS, type PostKind } from '#lib/features/posts/format';
import { requireStaff } from '#lib/server/http';
import { attempt, str } from '../courses/options.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const k = url.searchParams.get('kind') as PostKind | null;
	const kind = k && POST_KINDS.includes(k) ? k : undefined;
	const status = url.searchParams.get('status');
	const rows = (await listPostsAdmin({ kind })).filter((r) => (status === 'published' ? r.published : status === 'draft' ? !r.published : true));
	return { rows, filtered: Boolean(kind || status) };
};

export const actions: Actions = {
	publish: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			const on = fd.get('on') === 'true';
			await setPostPublished(str(fd, 'id'), on);
			return { message: on ? 'Post published' : 'Post moved to drafts' };
		});
	}
};
