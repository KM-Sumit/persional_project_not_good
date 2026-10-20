import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { verifyPaymentSignature, verifyWebhookSignature } from './razorpay';

const sign = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');

describe('razorpay signatures', () => {
	test('payment signature over order_id|payment_id', () => {
		const sig = sign('sk_test', 'order_1|pay_1');
		expect(verifyPaymentSignature('order_1', 'pay_1', sig, 'sk_test')).toBe(true);
		expect(verifyPaymentSignature('order_1', 'pay_2', sig, 'sk_test')).toBe(false);
		expect(verifyPaymentSignature('order_1', 'pay_1', sig, 'other')).toBe(false);
		expect(verifyPaymentSignature('order_1', 'pay_1', 'short', 'sk_test')).toBe(false);
	});

	test('webhook signature over the raw body', () => {
		const body = '{"event":"payment.captured","payload":{}}';
		const sig = sign('whsec', body);
		expect(verifyWebhookSignature(body, sig, 'whsec')).toBe(true);
		expect(verifyWebhookSignature(body + ' ', sig, 'whsec')).toBe(false);
		expect(verifyWebhookSignature(body, sig, 'nope')).toBe(false);
	});
});
