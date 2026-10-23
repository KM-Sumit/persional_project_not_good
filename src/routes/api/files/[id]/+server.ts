import { redirect } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { openFile, paidRefs } from '#lib/features/files/server/service';
import { courseAccess, noteAccess } from '#lib/features/billing/server/paywall';
import { SIGNED_TTL_SEC } from '#lib/features/files/server/r2';
import { requireUser, toHttp } from '#lib/server/http';
import type { RequestHandler } from './$types';

/** 302 to a short-lived signed R2 URL. Public-site images skip the sign-in check. */
export const GET: RequestHandler = async (event) => {
	let res: Awaited<ReturnType<typeof openFile>>;
	try {
		res = await openFile(event.params.id);
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
	const cache = `${res.public ? 'public' : 'private'}, max-age=${SIGNED_TTL_SEC - 60}`;
	if (res.bytes) {
		const total = res.bytes.byteLength;
		const headers: Record<string, string> = {
			'content-type': res.mime,
			'accept-ranges': 'bytes',
			'cache-control': cache,
			'content-disposition': 'inline'
		};
		const range = event.request.headers.get('range');
		const match = range && /^bytes=(\d+)-(\d*)$/.exec(range);
		if (match) {
			const start = Number(match[1]);
			const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
			if (start > end || start >= total) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${total}` } });
			const slice = res.bytes.subarray(start, end + 1);
			return new Response(slice, {
				status: 206,
				headers: { ...headers, 'content-range': `bytes ${start}-${end}/${total}`, 'content-length': String(slice.byteLength) }
			});
		}
		return new Response(res.bytes, { headers: { ...headers, 'content-length': String(total) } });
	}
	event.setHeaders({ 'cache-control': cache });
	redirect(302, res.url!, { external: true }); // R2 is another origin; SvelteKit 3 refuses it otherwise
};
