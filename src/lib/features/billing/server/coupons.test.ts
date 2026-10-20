import { afterAll, beforeAll, expect, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { coupons, courses, examCategories, exams, notes, payments, products, users } from '../../../server/db/schema';
import { discountInr } from '../format';
import * as cp from './coupons';
import { courseAccess, noteAccess, teaserMarkdown } from './paywall';
import * as svc from './service';

const tag = crypto.randomUUID().slice(0, 8).toUpperCase();
let userId = '';
let categoryId = '';
let examId = '';
let courseId = '';
let noteId = '';
let freeCourseId = '';
const productIds: string[] = [];
const couponIds: string[] = [];

beforeAll(async () => {
	const [c] = await db().insert(examCategories).values({ name: `Cpn ${tag}`, slug: `cpn-${tag.toLowerCase()}` }).returning();
	categoryId = c!.id;
	const [e] = await db().insert(exams).values({ categoryId, name: `Exam ${tag}`, slug: `cpn-exam-${tag.toLowerCase()}` }).returning();
	examId = e!.id;
	const [u] = await db().insert(users).values({ email: `cpn-${tag.toLowerCase()}@test.local`, name: 'Coupon Test' }).returning();
	userId = u!.id;
	const [co] = await db().insert(courses).values({ slug: `cpn-${tag.toLowerCase()}`, title: 'Paid course', examId, isPaid: true }).returning();
	courseId = co!.id;
	const [fc] = await db().insert(courses).values({ slug: `cpn-free-${tag.toLowerCase()}`, title: 'Free course', examId }).returning();
	freeCourseId = fc!.id;
	const [n] = await db().insert(notes).values({ slug: `cpn-${tag.toLowerCase()}`, title: 'Paid note', examId, isPaid: true }).returning();
	noteId = n!.id;
});

afterAll(async () => {
	await db().delete(users).where(eq(users.id, userId));
	if (couponIds.length) await db().delete(coupons).where(inArray(coupons.id, couponIds));
	if (productIds.length) await db().delete(products).where(inArray(products.id, productIds));
	await db().delete(courses).where(inArray(courses.id, [courseId, freeCourseId]));
	await db().delete(notes).where(eq(notes.id, noteId));
	await db().delete(examCategories).where(eq(examCategories.id, categoryId));
});

test('discount math: percent rounds, amount caps, never below ₹1', () => {
	expect(discountInr(499, { percentOff: 10, amountOffInr: null })).toBe(50);
	expect(discountInr(499, { percentOff: null, amountOffInr: 100 })).toBe(100);
	expect(discountInr(499, { percentOff: 100, amountOffInr: null })).toBe(498);
	expect(discountInr(1, { percentOff: 50, amountOffInr: null })).toBe(0);
});

test('teaser keeps whole leading blocks, about a quarter', () => {
	const md = Array.from({ length: 20 }, (_, i) => `Paragraph ${i} `.repeat(10)).join('\n\n');
	const t = teaserMarkdown(md);
	expect(t.startsWith('Paragraph 0')).toBe(true);
	expect(t.length).toBeLessThan(md.length / 2);
	expect(teaserMarkdown('one block only')).toBe('one block only');
});

test('coupons: quote rules, scope, expiry, use count moves only on payment success', async () => {
	const pass = await svc.createProduct({ kind: 'exam_pass', priceInr: 500, examId, validityDays: 30 }, null);
	const other = await svc.createProduct({ kind: 'course', priceInr: 300, courseId }, null);
	productIds.push(pass.id, other.id);

	const id = await cp.saveCoupon(null, { code: `t${tag}`, type: 'percent', value: '20', productId: pass.id, maxUses: '1' }, null);
	couponIds.push(id);
	await expect(cp.saveCoupon(null, { code: `T${tag}`, type: 'amount', value: '5' }, null)).rejects.toThrow('already used');

	const q = await cp.quoteCoupon(` t${tag.toLowerCase()} `, pass);
	expect(q).toMatchObject({ couponId: id, code: `T${tag}`, offInr: 100, totalInr: 400 });
	await expect(cp.quoteCoupon(`T${tag}`, other)).rejects.toThrow('does not apply');
	await expect(cp.quoteCoupon('NOPE-' + tag, pass)).rejects.toThrow('not valid');
	await expect(cp.quoteCoupon(`T${tag}`, pass, new Date(Date.now() + 1e12))).resolves.toBeTruthy(); // no expiry set

	// order created with the coupon does not count a use; success does, once
	const orderId = `order_cpn_${tag}`;
	await db().insert(payments).values({ userId, productId: pass.id, amountPaise: 40_000, couponId: id, razorpayOrderId: orderId, receipt: `C-${tag}` });
	expect((await cp.listCoupons()).find((c) => c.id === id)?.used).toBe(0);
	await Promise.all([svc.markPaid(orderId, `pay_cpn_${tag}`), svc.markPaid(orderId, `pay_cpn_${tag}`)]);
	expect((await cp.listCoupons()).find((c) => c.id === id)?.used).toBe(1);
	await expect(cp.quoteCoupon(`T${tag}`, pass)).rejects.toThrow('fully used');
	await expect(cp.deleteCoupon(id, null)).rejects.toThrow('Turn it off');

	await cp.saveCoupon(id, { code: `T${tag}`, type: 'amount', value: '50', validUntil: '2000-01-01', active: 'true' }, null);
	await expect(cp.quoteCoupon(`T${tag}`, other)).rejects.toThrow('expired');
	await cp.setCouponActive(id, false, null);
	await expect(cp.quoteCoupon(`T${tag}`, other)).rejects.toThrow('not valid');

	// the paid exam pass now opens the paid course and note of that exam
	expect(await courseAccess(userId, courseId)).toBe(true);
	expect(await noteAccess(userId, noteId)).toBe(true);
});

test('paywall: free is always open, paid needs access, unknown is closed', async () => {
	const [u] = await db().insert(users).values({ email: `cpn2-${tag.toLowerCase()}@test.local`, name: 'No pass' }).returning();
	try {
		expect(await courseAccess(u!.id, freeCourseId)).toBe(true);
		expect(await courseAccess(u!.id, courseId)).toBe(false);
		expect(await noteAccess(u!.id, noteId)).toBe(false);
		expect(await courseAccess(u!.id, crypto.randomUUID())).toBe(false);
		await db().update(users).set({ role: 'teacher' }).where(eq(users.id, u!.id));
		expect(await courseAccess(u!.id, courseId)).toBe(true);
	} finally {
		await db().delete(users).where(eq(users.id, u!.id));
	}
});
