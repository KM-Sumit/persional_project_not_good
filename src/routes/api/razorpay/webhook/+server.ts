// Razorpay webhook (payment.captured, order.paid, payment.failed). Signature is checked over the exact raw body.
import { handleWebhook } from '#lib/features/billing/server/service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.text();
	if (raw.length > 1_000_000) return new Response('Too large', { status: 413 });
	const status = await handleWebhook(raw, request.headers.get('x-razorpay-signature'));
	return new Response(status === 200 ? 'ok' : 'rejected', { status });
};
