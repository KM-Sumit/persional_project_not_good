// Public, read-only browsing queries for the website (exam pages, next live test, prices).
// Only public content: published, not batch-restricted.
// ponytail: uncached (cheap indexed reads); wrap in cached() with a cacheKeys entry if landing traffic needs it.
import { and, asc, count, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { notes, products, tests } from '#lib/server/db/schema';
import { questionCountSql, totalMarksSql } from '#lib/features/tests/server/service';
import { enabledOnly, tree } from '#lib/features/taxonomy/server/service';
import { outline, publicCatalog } from '#lib/features/courses/server/service';

export type PublicTest = {
	id: string;
	title: string;
	kind: 'practice' | 'mock' | 'pyq' | 'live' | 'daily';
	access: 'open' | 'password' | 'paid';
	examId: string | null;
	durationMin: number;
	questions: number;
	marks: number;
	negativeMarks: number;
	startsAt: string | null;
	year: number | null;
	language: string;
};
export type PassProduct = { id: string; title: string; description: string; priceInr: number; mrpInr: number | null; validityDays: number | null; validUntil: string | null };

const publicTest = and(eq(tests.status, 'published'), isNull(tests.batchId));
const notOver = or(isNull(tests.startsAt), sql`${tests.startsAt} + make_interval(mins => ${tests.durationMin}) > now()`);

const testCols = {
	id: tests.id,
	title: tests.title,
	kind: tests.kind,
	access: tests.access,
	examId: tests.examId,
	durationMin: tests.durationMin,
	questions: questionCountSql,
	marks: totalMarksSql,
	negativeMarks: tests.negativeMarks,
	startsAt: tests.startsAt,
	year: tests.year,
	language: tests.language
};
const toTest = (r: Omit<PublicTest, 'startsAt'> & { startsAt: Date | null }): PublicTest => ({ ...r, startsAt: r.startsAt?.toISOString() ?? null });

/** The next public live test that has not finished yet (the landing "admit card"). */
export async function nextLiveTest(): Promise<(PublicTest & { examName: string | null }) | null> {
	const [r] = await db()
		.select(testCols)
		.from(tests)
		.where(and(publicTest, eq(tests.kind, 'live'), gt(sql`${tests.startsAt} + make_interval(mins => ${tests.durationMin})`, sql`now()`)))
		.orderBy(asc(tests.startsAt))
		.limit(1);
	if (!r) return null;
	const exam = r.examId ? (await tree()).categories.flatMap((c) => c.exams).find((e) => e.id === r.examId) : null;
	return { ...toTest(r), examName: exam?.name ?? null };
}

/** Per-exam content counts for the exam hub and category pages. */
export async function examCounts() {
	const [t, n, courses] = await Promise.all([
		db().select({ examId: tests.examId, n: count() }).from(tests).where(and(publicTest, notOver)).groupBy(tests.examId),
		db()
			.select({ examId: notes.examId, n: count() })
			.from(notes)
			.where(and(eq(notes.published, true), isNull(notes.batchId)))
			.groupBy(notes.examId),
		publicCatalog()
	]);
	const out = new Map<string, { tests: number; notes: number; courses: number }>();
	const at = (id: string | null) => {
		if (!id) return null;
		if (!out.has(id)) out.set(id, { tests: 0, notes: 0, courses: 0 });
		return out.get(id)!;
	};
	for (const r of t) { const c = at(r.examId); if (c) c.tests = r.n; }
	for (const r of n) { const c = at(r.examId); if (c) c.notes = r.n; }
	for (const r of courses) { const c = at(r.examId); if (c) c.courses++; }
	return Object.fromEntries(out);
}

/** Enabled taxonomy plus counts. */
export async function examHub() {
	const [t, counts] = await Promise.all([tree(), examCounts()]);
	return { categories: enabledOnly(t).categories, counts };
}

/** Everything the exam landing page shows, or null when the exam is unknown or disabled. */
export async function examPage(categorySlug: string, examSlug: string) {
	const cats = enabledOnly(await tree()).categories;
	const category = cats.find((c) => c.slug === categorySlug);
	const exam = category?.exams.find((e) => e.slug === examSlug);
	if (!category || !exam) return null;
	const [testRows, [{ n: noteCount }], courses, [pass], noteRows] = await Promise.all([
		db().select(testCols).from(tests).where(and(publicTest, notOver, eq(tests.examId, exam.id))).orderBy(asc(tests.startsAt), asc(tests.title)),
		db()
			.select({ n: count() })
			.from(notes)
			.where(and(eq(notes.published, true), isNull(notes.batchId), eq(notes.examId, exam.id))),
		publicCatalog().then((all) => all.filter((c) => c.examId === exam.id)),
		db()
			.select()
			.from(products)
			.where(and(eq(products.kind, 'exam_pass'), eq(products.active, true), eq(products.examId, exam.id)))
			.orderBy(asc(products.priceInr))
			.limit(1),
		db()
			.select({ slug: notes.slug, title: notes.title })
			.from(notes)
			.where(and(eq(notes.published, true), isNull(notes.batchId), eq(notes.examId, exam.id)))
			.orderBy(desc(notes.updatedAt))
			.limit(3)
	]);
	return {
		category,
		exam,
		tests: testRows.map(toTest),
		noteCount,
		notes: noteRows,
		courses,
		thumbs: await courseThumbs(courses.map((c) => c.slug)),
		pass: pass ? toPass(pass) : null
	};
}

const toPass = (p: typeof products.$inferSelect): PassProduct => ({
	id: p.id,
	title: p.title,
	description: p.description,
	priceInr: p.priceInr,
	mrpInr: p.mrpInr,
	validityDays: p.validityDays,
	validUntil: p.validUntil?.toISOString() ?? null
});

/** Active course products by course id (cheapest wins). */
export async function coursePrices(courseIds: string[]) {
	if (!courseIds.length) return {} as Record<string, PassProduct>;
	const rows = await db()
		.select()
		.from(products)
		.where(and(eq(products.kind, 'course'), eq(products.active, true), inArray(products.courseId, courseIds)))
		.orderBy(asc(products.priceInr));
	const out: Record<string, PassProduct> = {};
	for (const r of rows) if (r.courseId && !out[r.courseId]) out[r.courseId] = toPass(r);
	return out;
}


/** First video lesson's YouTube id per course slug (cached outlines), for cover thumbnails. */
export async function courseThumbs(slugs: string[]) {
	const out: Record<string, string> = {};
	await Promise.all(
		slugs.map(async (slug) => {
			const id = (await outline(slug))?.chapters.flatMap((ch) => ch.lessons).find((l) => l.youtubeId)?.youtubeId;
			if (id) out[slug] = id;
		})
	);
	return out;
}
