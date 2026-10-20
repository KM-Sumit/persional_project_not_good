import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '#lib/server/db';
import { chapters, courses, doubts, lessons, modules, questions, users } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { hit } from '#lib/server/rate-limit';
import { fileUrl } from '#lib/features/files/schema';
import { upload } from '#lib/features/files/server/service';
import { decodeCursor, encodeCursor } from '#lib/features/engage/schema';
import { renderMarkdown } from '#lib/features/notes/server/markdown';
import { answerInput, askInput, type AskInput, type DoubtDto, type Page, type QueueFilter, type StaffDoubtDto } from '../schema';

const PAGE = 30;
const answerer = alias(users, 'answerer');
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const cols = {
	d: doubts,
	cursorAt: sql<string>`${doubts.createdAt}::text`,
	lessonTitle: lessons.title,
	courseId: courses.id,
	courseSlug: courses.slug,
	prompt: questions.prompt,
	moduleId: questions.moduleId,
	examId: sql<string | null>`coalesce(${courses.examId}, ${modules.examId}, ${users.targetExamId})`,
	studentName: users.name,
	studentEmail: users.email,
	answeredBy: answerer.name
};

function base() {
	return db()
		.select(cols)
		.from(doubts)
		.innerJoin(users, eq(users.id, doubts.userId))
		.leftJoin(lessons, eq(lessons.id, doubts.lessonId))
		.leftJoin(chapters, eq(chapters.id, lessons.chapterId))
		.leftJoin(courses, eq(courses.id, chapters.courseId))
		.leftJoin(questions, eq(questions.id, doubts.questionId))
		.leftJoin(modules, eq(modules.id, questions.moduleId))
		.leftJoin(answerer, eq(answerer.id, doubts.answeredById))
		.$dynamic();
}
type Row = Awaited<ReturnType<ReturnType<typeof base>['execute']>>[number];

/** "Lesson: …" / "Question: …" — also the only context the AI sees besides the doubt. */
export const contextOf = (r: Pick<Row, 'lessonTitle' | 'prompt'>, max = 160) =>
	r.lessonTitle ? `Lesson: ${r.lessonTitle}` : r.prompt ? `Question: ${short(r.prompt.replace(/\s+/g, ' '), max)}` : null;

function toDto(r: Row, withHtml: boolean): DoubtDto {
	const d = r.d;
	return {
		id: d.id,
		body: d.body,
		status: d.status,
		unread: d.status === 'answered',
		imageUrl: d.imageFileId ? fileUrl(d.imageFileId) : null,
		lessonId: d.lessonId,
		questionId: d.questionId,
		context: contextOf(r),
		contextHref: d.lessonId && r.courseSlug ? `/app/learn/${r.courseSlug}/${d.lessonId}` : null,
		answer: d.answer,
		answerHtml: withHtml && d.answer ? renderMarkdown(d.answer) : null,
		createdAt: d.createdAt.toISOString(),
		answeredAt: d.answeredAt?.toISOString() ?? null
	};
}

function toStaff(r: Row, withHtml: boolean): StaffDoubtDto {
	const d = r.d;
	return {
		...toDto(r, withHtml),
		contextHref: d.lessonId && r.courseId ? `/admin/courses/${r.courseId}/lessons/${d.lessonId}` : r.moduleId ? `/admin/bank/${r.moduleId}` : null,
		aiDraft: d.aiDraft,
		student: { id: d.userId, name: r.studentName || r.studentEmail.split('@')[0]!, email: r.studentEmail },
		examId: r.examId,
		answeredBy: r.answeredBy || null
	};
}

async function paged<T>(where: (SQL | undefined)[], cursor: string | null | undefined, map: (r: Row) => T, limit = PAGE): Promise<Page<T>> {
	const c = decodeCursor(cursor);
	const rows = await base()
		.where(and(...where, c ? sql`(${doubts.createdAt}, ${doubts.id}) < (${c.createdAt}::timestamptz, ${c.id}::uuid)` : undefined))
		.orderBy(desc(doubts.createdAt), desc(doubts.id))
		.limit(limit + 1);
	const items = rows.slice(0, limit);
	const last = items.at(-1);
	return { items: items.map(map), next: rows.length > limit && last ? encodeCursor(last.cursorAt, last.d.id) : null };
}

// ---------- student ----------

/** Creates a doubt. `photo` (optional) goes through the files service: images only, 5 MB. */
export async function ask(userId: string, raw: AskInput, photo?: File | null): Promise<{ id: string }> {
	const input = askInput.parse(raw);
	if (!(await hit(`doubt:${userId}`, 30, 86_400))) throw new DomainError(429, 'You have asked 30 doubts today. Try again tomorrow.');
	const ids = await linkCheck(input.lessonId, input.questionId);
	const image = photo && photo.size > 0 ? await upload(photo, userId, 'image') : null;
	const [row] = await db()
		.insert(doubts)
		.values({ userId, body: input.body, ...ids, imageFileId: image?.id ?? null })
		.returning({ id: doubts.id });
	return { id: row!.id };
}

/** Drops links to rows that no longer exist instead of failing the whole doubt. */
async function linkCheck(lessonId?: string, questionId?: string) {
	const [l, q] = await Promise.all([
		lessonId ? db().select({ id: lessons.id }).from(lessons).where(eq(lessons.id, lessonId)).limit(1) : [],
		questionId ? db().select({ id: questions.id }).from(questions).where(eq(questions.id, questionId)).limit(1) : []
	]);
	return { lessonId: l[0]?.id ?? null, questionId: q[0]?.id ?? null };
}

const statusWhere = (f?: QueueFilter | null) =>
	f === 'open' ? eq(doubts.status, 'open') : f === 'answered' ? inArray(doubts.status, ['answered', 'closed']) : undefined;

export const listMine = (userId: string, cursor?: string | null, filter?: QueueFilter | null) =>
	paged([eq(doubts.userId, userId), statusWhere(filter)], cursor, (r) => toDto(r, false));

export async function unreadAnswers(userId: string): Promise<number> {
	const [r] = await db()
		.select({ n: sql<number>`count(*)::int` })
		.from(doubts)
		.where(and(eq(doubts.userId, userId), eq(doubts.status, 'answered')));
	return r?.n ?? 0;
}

/** The student's own doubt. Opening an answered one marks the answer read (answered -> closed). */
export async function getMine(userId: string, id: string): Promise<DoubtDto> {
	const r = await one(id);
	if (!r || r.d.userId !== userId) throw new DomainError(404, 'Doubt not found.');
	const dto = toDto(r, true);
	if (r.d.status === 'answered') await db().update(doubts).set({ status: 'closed' }).where(and(eq(doubts.id, id), eq(doubts.status, 'answered')));
	return dto;
}

async function one(id: string): Promise<Row | undefined> {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
	const [r] = await base().where(eq(doubts.id, id)).limit(1);
	return r;
}

// ---------- staff ----------

export type QueueQuery = { filter?: QueueFilter | null; examId?: string | null; q?: string | null; cursor?: string | null; limit?: number };

const examExpr = sql`coalesce(${courses.examId}, ${modules.examId}, ${users.targetExamId})`;

export function queue(o: QueueQuery = {}): Promise<Page<StaffDoubtDto>> {
	const q = o.q?.trim().slice(0, 100);
	const like = q ? `%${q.replace(/[%_\\]/g, '\\$&')}%` : null;
	return paged(
		[
			statusWhere(o.filter),
			o.examId && /^[0-9a-f-]{36}$/i.test(o.examId) ? sql`${examExpr} = ${o.examId}::uuid` : undefined,
			like ? or(ilike(doubts.body, like), ilike(users.name, like), ilike(users.email, like)) : undefined
		],
		o.cursor,
		(r) => toStaff(r, false),
		Math.min(Math.max(o.limit ?? PAGE, 1), 100)
	);
}

export async function openCount(): Promise<number> {
	const [r] = await db().select({ n: sql<number>`count(*)::int` }).from(doubts).where(eq(doubts.status, 'open'));
	return r?.n ?? 0;
}

export async function getForStaff(id: string): Promise<StaffDoubtDto> {
	const r = await one(id);
	if (!r) throw new DomainError(404, 'Doubt not found.');
	return toStaff(r, true);
}

/** Saves the answer. Re-answering an already read doubt shows the dot again (status back to answered). */
export async function answer(id: string, staffId: string, raw: { answer: unknown }): Promise<{ userId: string }> {
	const { answer: text } = answerInput.parse(raw);
	const rows = await db()
		.update(doubts)
		.set({ answer: text, status: 'answered', answeredById: staffId, answeredAt: new Date() })
		.where(eq(doubts.id, id))
		.returning({ userId: doubts.userId });
	if (!rows[0]) throw new DomainError(404, 'Doubt not found.');
	return rows[0];
}

export async function saveDraft(id: string, draft: string): Promise<void> {
	await db().update(doubts).set({ aiDraft: draft }).where(eq(doubts.id, id));
}

/** What the AI needs: the doubt text and the one-line link context. Nothing else (token budget). */
export async function draftContext(id: string): Promise<{ body: string; context: string | null }> {
	const r = await one(id);
	if (!r) throw new DomainError(404, 'Doubt not found.');
	return { body: r.d.body, context: contextOf(r, 500) };
}
