import type { RequestHandler } from './$types';

// Report-only CSP target (vite.config.ts). Logs one line per violation so the policy can be enforced later.
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text().catch(() => '');
	console.warn('[csp]', body.slice(0, 500));
	return new Response(null, { status: 204 });
};
