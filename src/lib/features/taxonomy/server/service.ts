// Exam categories -> exams, and subjects. One taxonomy shared by courses, notes, questions and tests.
import { asc, count, eq } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { examCategories, exams, subjects } from '../../../server/db/schema';
import { cached, cacheKeys, invalidate } from '../../../server/cache/index';
import { DomainError } from '../../../server/http';
import { uniqueSlug } from '../../courses/server/slug';
import {
	categoryInput,
	categoryUpdate,
	examInput,
	examUpdate,
	subjectInput,
	type ExamDTO,
	type TaxonomyTree
} from '../schema';
import type { z } from 'zod';

const bust = () => invalidate(cacheKeys.taxonomy);
const isUnique = (e: unknown) =>
	(e as { code?: string })?.code === '23505' || (e as { cause?: { code?: string } })?.cause?.code === '23505';
async function guard<T>(fn: () => Promise<T>, what: string): Promise<T> {
	try {
		return await fn();
	} catch (e) {
		if (isUnique(e)) throw new DomainError(409, `${what} already exists.`);
		throw e;
	}
}

/** Full tree incl. disabled entries (staff); filter with `enabledOnly` for students. */
export const tree = () =>
	cached(cacheKeys.taxonomy, 600, async (): Promise<TaxonomyTree> => {
		const [cats, ex, subs] = await Promise.all([
			db().select().from(examCategories).orderBy(asc(examCategories.sortOrder), asc(examCategories.name)),
			db().select().from(exams).orderBy(asc(exams.sortOrder), asc(exams.name)),
			db().select().from(subjects).orderBy(asc(subjects.sortOrder), asc(subjects.name))
		]);
		const toExam = (e: (typeof ex)[number]): ExamDTO => ({
			id: e.id,
			categoryId: e.categoryId,
			name: e.name,
			slug: e.slug,
			description: e.description,
			sortOrder: e.sortOrder,
			enabled: e.enabled
		});
		return {
			categories: cats.map((c) => ({
				id: c.id,
				name: c.name,
				slug: c.slug,
				description: c.description,
				sortOrder: c.sortOrder,
				enabled: c.enabled,
				exams: ex.filter((e) => e.categoryId === c.id).map(toExam)
			})),
			subjects: subs
		};
	});

export function enabledOnly(t: TaxonomyTree): TaxonomyTree {
	return {
		...t,
		categories: t.categories.filter((c) => c.enabled).map((c) => ({ ...c, exams: c.exams.filter((e) => e.enabled) }))
	};
}

/** Flat exam lookup by id (names for cards and filters). */
export async function examMap() {
	return new Map((await tree()).categories.flatMap((c) => c.exams.map((e) => [e.id, { ...e, categoryName: c.name }] as const)));
}

const catSlug = (source: string) =>
	uniqueSlug(source, async (s) => Boolean((await db().select({ id: examCategories.id }).from(examCategories).where(eq(examCategories.slug, s)).limit(1)).length));
const examSlug = (source: string) =>
	uniqueSlug(source, async (s) => Boolean((await db().select({ id: exams.id }).from(exams).where(eq(exams.slug, s)).limit(1)).length));
const countOf = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;

// ---------- categories ----------
export async function createCategory(raw: z.input<typeof categoryInput>) {
	const input = categoryInput.parse(raw);
	const slug = input.slug ?? (await catSlug(input.name));
	const [row] = await guard(
		async () => db().insert(examCategories).values({ ...input, slug, sortOrder: await countOf(db().select({ n: count() }).from(examCategories)) }).returning({ id: examCategories.id }),
		'A category with that slug'
	);
	await bust();
	return row!;
}

export async function updateCategory(id: string, raw: z.input<typeof categoryUpdate>) {
	const input = categoryUpdate.parse(raw);
	const [row] = await guard(() => db().update(examCategories).set(input).where(eq(examCategories.id, id)).returning({ id: examCategories.id }), 'A category with that slug');
	if (!row) throw new DomainError(404, 'Category not found.');
	await bust();
}

/** Cascades to its exams; content tagged with those exams keeps existing, untagged. */
export async function deleteCategory(id: string) {
	await db().delete(examCategories).where(eq(examCategories.id, id));
	await bust();
}

export async function reorderCategories(ids: string[]) {
	await db().transaction(async (tx) => {
		for (const [i, id] of ids.entries()) await tx.update(examCategories).set({ sortOrder: i }).where(eq(examCategories.id, id));
	});
	await bust();
}

// ---------- exams ----------
export async function createExam(raw: z.input<typeof examInput>) {
	const input = examInput.parse(raw);
	const slug = input.slug ?? (await examSlug(input.name));
	const [row] = await guard(
		async () =>
			db().insert(exams).values({ ...input, slug, sortOrder: await countOf(db().select({ n: count() }).from(exams).where(eq(exams.categoryId, input.categoryId))) }).returning({ id: exams.id }),
		'An exam with that slug'
	);
	await bust();
	return row!;
}

export async function updateExam(id: string, raw: z.input<typeof examUpdate>) {
	const input = examUpdate.parse(raw);
	const [row] = await guard(() => db().update(exams).set(input).where(eq(exams.id, id)).returning({ id: exams.id }), 'An exam with that slug');
	if (!row) throw new DomainError(404, 'Exam not found.');
	await bust();
}

export async function deleteExam(id: string) {
	await db().delete(exams).where(eq(exams.id, id));
	await bust();
}

export async function reorderExams(categoryId: string, ids: string[]) {
	await db().transaction(async (tx) => {
		for (const [i, id] of ids.entries()) await tx.update(exams).set({ sortOrder: i, categoryId }).where(eq(exams.id, id));
	});
	await bust();
}

export const setCategoryEnabled = (id: string, enabled: boolean) => updateCategory(id, { enabled });
export const setExamEnabled = (id: string, enabled: boolean) => updateExam(id, { enabled });

// ---------- subjects ----------
export async function createSubject(raw: z.input<typeof subjectInput>) {
	const { name } = subjectInput.parse(raw);
	const [row] = await guard(
		async () => db().insert(subjects).values({ name, sortOrder: await countOf(db().select({ n: count() }).from(subjects)) }).returning(),
		'That subject'
	);
	await bust();
	return row!;
}

export async function updateSubject(id: string, raw: z.input<typeof subjectInput>) {
	const { name } = subjectInput.parse(raw);
	const [row] = await guard(() => db().update(subjects).set({ name }).where(eq(subjects.id, id)).returning(), 'That subject');
	if (!row) throw new DomainError(404, 'Subject not found.');
	await bust();
}

export async function deleteSubject(id: string) {
	await db().delete(subjects).where(eq(subjects.id, id));
	await bust();
}

export async function reorderSubjects(ids: string[]) {
	await db().transaction(async (tx) => {
		for (const [i, id] of ids.entries()) await tx.update(subjects).set({ sortOrder: i }).where(eq(subjects.id, id));
	});
	await bust();
}
