// Billing: products, payments, entitlements. Zod inputs, DTOs and the pure expiry math. Client-safe.
import { z } from 'zod';

import { kindLabel, paymentStatuses, productKinds } from './format';
export * from './format';

const blank = (v: unknown) => (v === '' || v === null ? undefined : v);
const optUuid = () => z.preprocess(blank, z.uuid().optional());
const optInt = (min: number, max: number) => z.preprocess(blank, z.coerce.number().int().min(min).max(max).optional());
const bool = z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean());

export const productInput = z
	.object({
		kind: z.enum(productKinds),
		title: z.string().trim().max(160).default(''), // blank = named after what it unlocks
		description: z.string().trim().max(4000).default(''),
		priceInr: z.coerce.number().int('Price is in whole rupees.').min(1, 'Price must be at least ₹1.').max(500000),
		mrpInr: optInt(1, 500000),
		examId: optUuid(),
		courseId: optUuid(),
		testId: optUuid(),
		validityDays: optInt(1, 3650),
		validUntil: z.preprocess(blank, z.iso.date().or(z.iso.datetime({ offset: true })).optional()),
		active: bool.default(true)
	})
	.superRefine((p, ctx) => {
		const need = { exam_pass: 'examId', course: 'courseId', test: 'testId' } as const;
		const key = need[p.kind];
		if (!p[key]) ctx.addIssue({ code: 'custom', path: [key], message: `Pick the ${kindLabel[p.kind].toLowerCase()} this unlocks.` });
		if (p.mrpInr != null && p.mrpInr < p.priceInr) ctx.addIssue({ code: 'custom', path: ['mrpInr'], message: 'MRP must be at least the price.' });
	});
export type ProductInput = z.input<typeof productInput>;

export const checkoutVerify = z.object({
	razorpay_order_id: z.string().min(1).max(64),
	razorpay_payment_id: z.string().min(1).max(64),
	razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/)
});

export const grantInput = z.object({
	userId: z.uuid('Pick a student.'),
	productId: z.uuid('Pick a product.'),
	expiresAt: z.preprocess(blank, z.iso.date().optional()) // blank = the product's own validity
});

export const couponCode = z
	.string()
	.trim()
	.toUpperCase()
	.regex(/^[A-Z0-9][A-Z0-9_-]{2,23}$/, 'Codes are 3 to 24 letters, numbers, - or _.');

export const couponInput = z
	.object({
		code: couponCode,
		type: z.enum(['percent', 'amount']),
		value: z.coerce.number().int('Use a whole number.').min(1, 'The discount must be at least 1.'),
		productId: optUuid(),
		maxUses: optInt(1, 1_000_000),
		validUntil: z.preprocess(blank, z.iso.date().optional()), // last day it works (IST)
		active: bool.default(true)
	})
	.refine((c) => c.type === 'amount' || c.value <= 100, { path: ['value'], message: 'A percent discount is at most 100.' });
export type CouponInput = z.input<typeof couponInput>;

export const paymentFilter = z.object({
	status: z.enum(paymentStatuses).optional().catch(undefined),
	q: z.string().trim().max(100).optional(),
	cursor: z.string().max(200).optional()
});

