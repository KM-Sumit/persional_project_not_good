import { redirect } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { paidRefs, signedUrl } from '#lib/features/files/server/service';
import { courseAccess, noteAccess } from '#lib/features/billing/server/paywall';
import { SIGNED_TTL_SEC } from '#lib/features/files/server/r2';
import { requireUser, toHttp } from '#lib/server/http';
import type { RequestHandler } from './$types';

/** 302 to a short-lived signed R2 URL. Public-site images skip the sign-in check. */
export const GET: RequestHandler = async (event) => {
	let res: Awaited<ReturnType<typeof signedUrl>>;
	try {
		res = await signedUrl(event.params.id);
	} catch (e) {
		toHttp(e);
	}
	if (!res.public) {
		const user = requireUser(event);
		// A paid note's PDF or a paid lesson's file only goes to people who unlocked it (staff pass inside the checks).
		const refs = await paidRefs(event.params.id);
		if (refs.noteIds.length || refs.courseIds.length) {
			const checks = [...refs.noteIds.map((id) => noteAccess(user.id, id)), ...refs.courseIds.map((id) => courseAccess(user.id, id))];
			if (!(await Promise.all(checks)).some(Boolean)) error(403, 'Unlock this course or pass to open the file.');
		}
	}
	// Browsers may reuse the redirect a little less long than the signature lives.
	event.setHeaders({ 'cache-control': `${res.public ? 'public' : 'private'}, max-age=${SIGNED_TTL_SEC - 60}` });
	redirect(302, res.url, { external: true }); // R2 is another origin; SvelteKit 3 refuses it otherwise
};
