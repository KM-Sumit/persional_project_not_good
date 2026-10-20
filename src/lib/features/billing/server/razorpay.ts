// Razorpay over plain REST (no SDK): Orders API + HMAC-SHA256 signature checks. Ported from campusquiz-svelte.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, razorpayEnabled } from '#lib/server/env';

export type RazorpayKeys = { keyId: string; keySecret: string; webhookSecret: string };

export function razorpayKeys(): RazorpayKeys | null {
	if (!razorpayEnabled()) return null;
	const e = env();
	return { keyId: e.RAZORPAY_KEY_ID!, keySecret: e.RAZORPAY_KEY_SECRET!, webhookSecret: e.RAZORPAY_WEBHOOK_SECRET! };
}

const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');

/** Constant-time compare of two hex strings (length mismatch is a plain false). */
export function safeEqualHex(a: string, b: string) {
	const x = Buffer.from(a, 'utf8');
	const y = Buffer.from(b, 'utf8');
	return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout success callback: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, keySecret: string) {
	return safeEqualHex(hmac(keySecret, `${orderId}|${paymentId}`), signature);
}

/** Webhook: X-Razorpay-Signature = HMAC_SHA256(raw body, webhook secret). Must be the exact raw bytes. */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string) {
	return safeEqualHex(hmac(webhookSecret, rawBody), signature);
}

export type RazorpayOrder = { id: string; amount: number; currency: string; receipt: string; status: string };

export async function createOrder(
	keys: RazorpayKeys,
	o: { amountPaise: number; receipt: string; notes?: Record<string, string> }
): Promise<RazorpayOrder> {
	const res = await fetch('https://api.razorpay.com/v1/orders', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Basic ' + Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString('base64')
		},
		body: JSON.stringify({ amount: o.amountPaise, currency: 'INR', receipt: o.receipt.slice(0, 40), notes: o.notes ?? {} }),
		signal: AbortSignal.timeout(15_000)
	});
	if (!res.ok) throw new Error(`Razorpay order failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
	return (await res.json()) as RazorpayOrder;
}
