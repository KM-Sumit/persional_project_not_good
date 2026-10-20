// Coupons: staff CRUD and the server-side quote used before a Razorpay order is created.
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '#lib/server/db';
import { coupons, payments, products } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { audit } from '../../site/server/audit';
import { couponCode, couponInput, discountInr, type CouponDTO, type CouponInput, type CouponQuote } from '../schema';

type CouponRow = typeof coupons.$inferSelect;
const toDTO = (c: CouponRow, productTitle: string | null): CouponDTO => ({
	id: c.id,
	code: c.code,
	percentOff: c.percentOff,
	amountOffInr: c.amountOffInr,
	productId: c.productId,
	productTitle,
	maxUses: c.maxUses,
	used: c.used,
	validUntil: c.validUntil?.toISOString() ?? null,
	active: c.active,
	createdAt: c.createdAt.toISOString()
});

export async function listCoupons(): Promise<CouponDTO[]> {
	const rows = await db()
		.select({ c: coupons, productTitle: products.title })
		.from(coupons)
		.leftJoin(products, eq(products.id, coupons.productId))
		.orderBy(desc(coupons.active), desc(coupons.createdAt));
	return rows.map((r) => toDTO(r.c, r.productTitle));
}

function values(raw: CouponInput) {
	const v = couponInput.parse(raw);
	return {
		code: v.code,
		percentOff: v.type === 'percent' ? v.value : null,
		amountOffInr: v.type === 'amount' ? v.value : null,
		productId: v.productId ?? null,
		maxUses: v.maxUses ?? null,
		validUntil: v.validUntil ? new Date(`${v.validUntil}T23:59:59+05:30`) : null,
		active: v.active
	};
}

const taken = (e: unknown) => (e as { code?: string; cause?: { code?: string } })?.code === '23505' || (e as { cause?: { code?: string } })?.cause?.code === '23505';

export async function saveCoupon(id: string | null, raw: CouponInput, actorId: string | null) {
	const v = values(raw);
	const isNew = !id;
	try {
		if (id) {
			const [c] = await db().update(coupons).set(v).where(eq(coupons.id, id)).returning({ id: coupons.id });
			if (!c) throw new DomainError(404, 'That coupon does not exist.');
		} else id = (await db().insert(coupons).values(v).returning({ id: coupons.id }))[0]!.id;
	} catch (e) {
		if (taken(e)) throw new DomainError(409, `The code ${v.code} is already used by another coupon.`);
		throw e;
	}
	await audit(actorId, isNew ? 'coupon.create' : 'coupon.update', id);
	return id;
}

export async function setCouponActive(id: string, active: boolean, actorId: string | null) {
	await db().update(coupons).set({ active }).where(eq(coupons.id, id));
	await audit(actorId, active ? 'coupon.activate' : 'coupon.deactivate', id);
}

/** Only unused coupons can go; used ones stay for the payment history. */
export async function deleteCoupon(id: string, actorId: string | null) {
	const [r] = await db().select({ n: sql<number>`count(*)::int` }).from(payments).where(eq(payments.couponId, id));
	if (r?.n) throw new DomainError(409, 'Orders used this coupon. Turn it off instead of deleting it.');
	await db().delete(coupons).where(eq(coupons.id, id));
	await audit(actorId, 'coupon.delete', id);
}

/**
 * Validates `code` for a product priced `priceInr` and returns the discounted total. Throws a DomainError with a
 * student-facing reason when it does not apply. Read-only: the use count only moves when a payment succeeds.
 */
export async function quoteCoupon(rawCode: string, product: { id: string; priceInr: number }, now = new Date()): Promise<CouponQuote> {
	const code = couponCode.safeParse(rawCode);
	const nope = (m: string) => new DomainError(400, m);
	if (!code.success) throw nope('That coupon code is not valid.');
	const [c] = await db().select().from(coupons).where(eq(coupons.code, code.data));
	if (!c || !c.active) throw nope('That coupon code is not valid.');
	if (c.validUntil && c.validUntil <= now) throw nope('This coupon has expired.');
	if (c.productId && c.productId !== product.id) throw nope('This coupon does not apply to this purchase.');
	if (c.maxUses != null && c.used >= c.maxUses) throw nope('This coupon has been fully used.');
	const offInr = discountInr(product.priceInr, c);
	if (!offInr) throw nope('This coupon gives no discount on this price.');
	return { couponId: c.id, code: c.code, offInr, totalInr: product.priceInr - offInr };
}

/** Coupon quote for the checkout form (looks the product up itself). */
export async function quoteForProduct(code: string, productId: string) {
	if (!z.uuid().safeParse(productId).success) throw new DomainError(404, 'This product does not exist.');
	const [p] = await db().select({ id: products.id, priceInr: products.priceInr }).from(products).where(eq(products.id, productId));
	if (!p) throw new DomainError(404, 'This product does not exist.');
	return quoteCoupon(code, p);
}
