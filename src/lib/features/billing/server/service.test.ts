import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { entitlements, examCategories, exams, payments, products, testGrants, tests, users } from '../../../server/db/schema';
import { expiryFor, productInput } from '../schema';
import * as svc from './service';

const tag = crypto.randomUUID().slice(0, 8);
const DAY = 86_400_000;
let userId = '';
let examId = '';
let categoryId = '';
let testId = '';
const productIds: string[] = [];

beforeAll(async () => {
	const [c] = await db().insert(examCategories).values({ name: `Bill ${tag}`, slug: `bill-${tag}` }).returning();
	categoryId = c!.id;
	const [e] = await db().insert(exams).values({ categoryId, name: `Exam ${tag}`, slug: `exam-${tag}` }).returning();
	examId = e!.id;
	const [u] = await db().insert(users).values({ email: `bill-${tag}@test.local`, name: 'Bill Test' }).returning();
	userId = u!.id;
	const [t] = await db().insert(tests).values({ title: `Paid ${tag}`, access: 'paid' }).returning();
	testId = t!.id;
});

afterAll(async () => {
	await db().delete(users).where(eq(users.id, userId)); // cascades payments, entitlements, grants
	if (productIds.length) await db().delete(products).where(inArray(products.id, productIds));
	await db().delete(tests).where(eq(tests.id, testId));
	await db().delete(examCategories).where(eq(examCategories.id, categoryId)); // cascades exams
});

test('expiry math: fixed date wins, days extend a live expiry, lifetime stays lifetime', () => {
	const now = new Date('2026-10-20T00:00:00Z');
	expect(expiryFor({ validityDays: 30, validUntil: null }, now)?.getTime()).toBe(now.getTime() + 30 * DAY);
	const live = new Date(now.getTime() + 10 * DAY);
	expect(expiryFor({ validityDays: 30, validUntil: null }, now, { expiresAt: live })?.getTime()).toBe(live.getTime() + 30 * DAY);
	const lapsed = new Date(now.getTime() - 10 * DAY);
	expect(expiryFor({ validityDays: 30, validUntil: null }, now, { expiresAt: lapsed })?.getTime()).toBe(now.getTime() + 30 * DAY);
	expect(expiryFor({ validityDays: 30, validUntil: '2027-03-12T00:00:00Z' }, now)?.toISOString()).toBe('2027-03-12T00:00:00.000Z');
	expect(expiryFor({ validityDays: null, validUntil: null }, now)).toBeNull();
	expect(expiryFor({ validityDays: 30, validUntil: null }, now, { expiresAt: null })).toBeNull();
	// a grant that already runs past a fixed exam date is never shortened
	const far = new Date('2028-01-01T00:00:00Z');
	expect(expiryFor({ validityDays: null, validUntil: '2027-03-12T00:00:00Z' }, now, { expiresAt: far })).toEqual(far);
});

test('product input needs the target for its kind and MRP >= price', () => {
	expect(productInput.safeParse({ kind: 'exam_pass', priceInr: 499 }).success).toBe(false);
	expect(productInput.safeParse({ kind: 'course', priceInr: 499, courseId: crypto.randomUUID(), mrpInr: 299 }).success).toBe(false);
	expect(productInput.safeParse({ kind: 'test', priceInr: '49', testId: crypto.randomUUID(), validityDays: '' }).success).toBe(true);
});

test('webhook: signature, idempotent credit, amount check, failure; hasAccess', async () => {
	const pass = await svc.createProduct({ kind: 'exam_pass', priceInr: 499, examId, validityDays: 90 }, null);
	productIds.push(pass.id);
	expect(pass.title).toBe(`Exam ${tag} Pass`);
	expect(await svc.hasAccess(userId, { examId })).toBe(false);

	const orderId = `order_test_${tag}`;
	await db().insert(payments).values({ userId, productId: pass.id, amountPaise: 49_900, razorpayOrderId: orderId, receipt: `T-${tag}-1` });

	const secret = 'whsec_test';
	const body = (event: string, amount: number, pid = `pay_${tag}`) =>
		JSON.stringify({ event, payload: { payment: { entity: { id: pid, order_id: orderId, amount } } } });
	const sign = (b: string) => createHmac('sha256', secret).update(b).digest('hex');

	expect(await svc.handleWebhook(body('payment.captured', 49_900), 'bad', secret)).toBe(400);

	// wrong amount never credits
	const cheap = body('payment.captured', 100);
	expect(await svc.handleWebhook(cheap, sign(cheap), secret)).toBe(200);
	expect(await svc.hasAccess(userId, { examId })).toBe(false);

	// callback and webhook racing: exactly one credit
	const results = await Promise.all([svc.markPaid(orderId, `pay_${tag}`), svc.markPaid(orderId, `pay_${tag}`, { amountPaise: 49_900 })]);
	expect(results.filter(Boolean)).toHaveLength(1);
	const ok = body('order.paid', 49_900);
	expect(await svc.handleWebhook(ok, sign(ok), secret)).toBe(200); // replay is a no-op
	const [e1] = await db().select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.productId, pass.id)));
	expect(e1!.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 89 * DAY);
	expect(e1!.expiresAt!.getTime()).toBeLessThan(Date.now() + 91 * DAY); // not double-extended
	expect(await svc.hasAccess(userId, { examId })).toBe(true);
	expect(await svc.hasAccess(userId, { courseId: crypto.randomUUID() })).toBe(false);
	expect((await svc.accessScope(userId)).examIds.has(examId)).toBe(true);

	// a later failure event cannot un-pay
	const fail = body('payment.failed', 49_900);
	expect(await svc.handleWebhook(fail, sign(fail), secret)).toBe(200);
	const [p1] = await db().select().from(payments).where(eq(payments.razorpayOrderId, orderId));
	expect(p1!.status).toBe('paid');

	// expired entitlement = no access; regrant restores it
	await db().update(entitlements).set({ expiresAt: new Date(Date.now() - DAY) }).where(eq(entitlements.userId, userId));
	expect(await svc.hasAccess(userId, { examId })).toBe(false);
	await svc.regrant(p1!.id, userId);
	expect(await svc.hasAccess(userId, { examId })).toBe(true);

	// refund removes access
	await svc.markRefunded(p1!.id, userId);
	expect(await svc.hasAccess(userId, { examId })).toBe(false);
	expect(await svc.markPaid(orderId, `pay_${tag}`)).toBe(false); // refunded is never re-credited

	const list = await svc.listPayments({ q: `bill-${tag}` });
	expect(list.rows).toHaveLength(1);
	expect(list.counts.refunded).toBe(1);
});

test('test access: manual test grant, test product, manual grant with expiry, revoke', async () => {
	expect(await svc.hasAccess(userId, { testId })).toBe(false);
	await db().insert(testGrants).values({ testId, userId });
	expect(await svc.hasAccess(userId, { testId })).toBe(true);
	await db().delete(testGrants).where(eq(testGrants.userId, userId));

	const single = await svc.createProduct({ kind: 'test', priceInr: 49, testId }, null);
	productIds.push(single.id);
	expect(await svc.grantManual({ userId, productId: single.id }, userId)).toBeNull(); // lifetime
	expect(await svc.hasAccess(userId, { testId })).toBe(true);
	await svc.revoke(userId, single.id, userId);
	expect(await svc.hasAccess(userId, { testId })).toBe(false);
	const until = await svc.grantManual({ userId, productId: single.id, expiresAt: '2000-01-01' }, userId);
	expect(until).toBe('2000-01-01T18:29:59.000Z');
	expect(await svc.hasAccess(userId, { testId })).toBe(false);
});
