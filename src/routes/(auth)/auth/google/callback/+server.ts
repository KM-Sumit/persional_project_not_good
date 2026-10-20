import { redirect } from '@sveltejs/kit';
import { FLOW_COOKIE, finishFlow, readFlow } from '#lib/server/auth/google';
import { homeFor, safeNext, startSession } from '#lib/server/auth/session';
import { signInWithGoogle } from '#lib/features/auth/server/service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const flow = await readFlow(cookies.get(FLOW_COOKIE));
	cookies.delete(FLOW_COOKIE, { path: '/' });
	const code = url.searchParams.get('code');
	const fail = (why: string): never => {
		// Tells a cancelled login (error=access_denied) from a misconfigured callback in the logs.
		console.warn('[auth] google sign-in failed', { why, host: url.host, error: url.searchParams.get('error') });
		const n = flow?.next ? safeNext(flow.next, '') : '';
		redirect(303, `/login?error=${why === 'suspended' ? 'suspended' : 'google'}${n ? `&next=${encodeURIComponent(n)}` : ''}`);
	};
	if (!flow || !code || url.searchParams.get('state') !== flow.state) return fail('state');

	let res;
	try {
		res = await signInWithGoogle(await finishFlow({ code, flow, origin: url.origin }));
	} catch (e) {
		return fail(e instanceof Error ? e.message : 'unknown');
	}
	if ('error' in res) return fail('suspended');
	await startSession(cookies, res.user);
	redirect(303, safeNext(flow.next, homeFor(res.user)));
};
