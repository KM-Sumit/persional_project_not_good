// Billing DTOs, labels and pure helpers. No zod here: safe for client bundles (zod's eval probe trips the CSP).
export const productKinds = ['exam_pass', 'course', 'test'] as const;
export const paymentStatuses = ['created', 'paid', 'failed', 'refunded'] as const;
export type ProductKind = (typeof productKinds)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];

export const kindLabel: Record<ProductKind, string> = { exam_pass: 'Exam pass', course: 'Course', test: 'Test' };

export type ProductDTO = {
	id: string;
	kind: ProductKind;
	title: string;
	description: string;
	priceInr: number;
	mrpInr: number | null;
	examId: string | null;
	courseId: string | null;
	testId: string | null;
	targetName: string; // the exam / course / test name
	validityDays: number | null;
	validUntil: string | null;
	active: boolean;
	sold: number;
	createdAt: string;
};

export type PaymentDTO = {
	id: string;
	receipt: string;
	status: PaymentStatus;
	amountPaise: number;
	productId: string;
	productTitle: string;
	productKind: ProductKind;
	userId: string;
	userName: string;
	userEmail: string;
	razorpayOrderId: string;
	razorpayPaymentId: string | null;
	error: string | null;
	couponCode: string | null;
	paidAt: string | null;
	createdAt: string;
};

export type EntitlementDTO = {
	productId: string;
	title: string;
	kind: ProductKind;
	targetName: string;
	href: string; // where the unlocked content lives
	expiresAt: string | null;
	granted: boolean; // given by staff, not bought
	active: boolean;
};

export type PaymentList = {
	rows: PaymentDTO[];
	nextCursor: string | null;
	counts: Record<PaymentStatus | 'all', number>;
	revenue: { todayPaise: number; monthPaise: number; allPaise: number };
};

export type CheckoutOrder = { keyId: string; orderId: string; amountPaise: number; receipt: string; title: string };

export type CouponDTO = {
	id: string;
	code: string;
	percentOff: number | null;
	amountOffInr: number | null;
	productId: string | null;
	productTitle: string | null; // null = any product
	maxUses: number | null;
	used: number;
	validUntil: string | null;
	active: boolean;
	createdAt: string;
};

/** A coupon applied to one product: what the student pays. */
export type CouponQuote = { couponId: string; code: string; offInr: number; totalInr: number };

/** Rupees off a price. Never below ₹1 (Razorpay's minimum order). */
export function discountInr(priceInr: number, c: { percentOff: number | null; amountOffInr: number | null }) {
	const off = c.percentOff ? Math.round((priceInr * c.percentOff) / 100) : (c.amountOffInr ?? 0);
	return Math.max(0, Math.min(off, priceInr - 1));
}

export const couponOffText = (c: { percentOff: number | null; amountOffInr: number | null }) =>
	c.percentOff ? `${c.percentOff}% off` : `${inr(c.amountOffInr ?? 0)} off`;

/** Is a paid course or note locked for this viewer, and which product unlocks it. */
export type PaywallOffer = Pick<ProductDTO, 'id' | 'kind' | 'title' | 'targetName' | 'priceInr' | 'mrpInr' | 'validityDays' | 'validUntil'>;
export type Paywall = { locked: boolean; offer: PaywallOffer | null };

/** One line of what an offer unlocks, e.g. "Every lesson, test and note for SSC CGL · 365 days". */
export function offerIncludes(o: PaywallOffer) {
	const what = o.kind === 'exam_pass' ? `Every lesson, test and note for ${o.targetName}` : o.kind === 'course' ? `Every lesson in ${o.targetName}` : `The test ${o.targetName}`;
	const span = o.validUntil ? `until ${fmtDate(o.validUntil)}` : o.validityDays ? `${o.validityDays} days` : 'lifetime access';
	return `${what} · ${span}`;
}

export const percentOff = (o: { priceInr: number; mrpInr: number | null }) =>
	o.mrpInr && o.mrpInr > o.priceInr ? Math.round(((o.mrpInr - o.priceInr) / o.mrpInr) * 100) : 0;

// ---------- pure helpers ----------
const DAY = 86_400_000;

/**
 * When a (re)purchase or grant ends. A fixed `validUntil` (exam date) wins; `validityDays` counts from now, or from
 * the current expiry when that is still in the future (renewing extends). An existing lifetime row stays lifetime.
 * Returns null for lifetime.
 */
export function expiryFor(
	p: { validityDays: number | null; validUntil: Date | string | null },
	now: Date,
	existing?: { expiresAt: Date | string | null } | null
): Date | null {
	if (existing && existing.expiresAt === null) return null;
	const cur = existing?.expiresAt ? new Date(existing.expiresAt) : null;
	let next: Date | null = null;
	if (p.validUntil) next = new Date(p.validUntil);
	else if (p.validityDays) next = new Date(Math.max(now.getTime(), cur?.getTime() ?? 0) + p.validityDays * DAY);
	if (!next) return null;
	return cur && cur > next ? cur : next;
}

export const isActive = (expiresAt: Date | string | null, now = new Date()) => expiresAt === null || new Date(expiresAt) > now;

export const inr = (rupees: number) => '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const inrPaise = (paise: number) => inr(paise / 100);

export function validityText(p: { validityDays: number | null; validUntil: string | null }) {
	if (p.validUntil) return `Valid until ${fmtDate(p.validUntil)}`;
	if (p.validityDays) return `Valid for ${p.validityDays} days`;
	return 'Lifetime access';
}

export const fmtDate = (d: string | Date) =>
	new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export function hrefFor(p: { kind: ProductKind; examId?: string | null; courseSlug?: string | null; testId?: string | null; examSlug?: string | null }) {
	if (p.kind === 'course' && p.courseSlug) return `/app/learn/${p.courseSlug}`;
	if (p.kind === 'test' && p.testId) return `/app/tests/${p.testId}`;
	if (p.kind === 'exam_pass' && p.examSlug) return `/app/tests?exam=${p.examSlug}`;
	return '/app';
}
