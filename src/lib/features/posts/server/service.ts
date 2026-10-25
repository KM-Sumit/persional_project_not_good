// Posts (daily current affairs, job alerts, syllabus pages) and the daily current-affairs quiz. Drizzle lives only here.
import { and, desc, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { attempts, exams, posts, tests } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { uniqueSlug } from '../../courses/server/slug';
import { renderDoc } from '../../notes/server/markdown';
import { createJob, getJob, markApplied } from '../../ai/server/service';
import { applyGenerated, createModule } from '../../bank/server/service';
import { addQuestions, createTest, publishTest } from '../../tests/server/service';
import { currentSession } from '../../cohorts/server/service';
import { postInput, postPatch, type PostCard, type PostDTO, type PostPage } from '../schema';
import { daysBefore, istDate, streakFrom, type PostKind } from '../format';
import { plainText } from './text';

type Row = typeof posts.$inferSelect;
const UUID = /^[0-9a-f-]{36}$/i;
/** Questions per daily quiz; one minute each. */
export const QUIZ_SIZE = 10;

const toDTO = (r: Row): PostDTO => ({
	id: r.id,
	kind: r.kind,
	slug: r.slug,
	title: r.title,
	body: r.body,
	examId: r.examId,
	fileId: r.fileId,
	quizTestId: r.quizTestId,
	publishedOn: r.publishedOn,
	published: r.published,
	createdAt: r.createdAt.toISOString()
});
const toCard = (r: Row, examName: string | null = null): PostCard => {
	const { body, ...rest } = toDTO(r);
	return { ...rest, excerpt: plainText(body.replace(/^#.*$/gm, ''), 180), examName };
};
const toPage = (r: Row, examName: string | null): PostPage => {
	const doc = renderDoc(r.body);
	return { ...toCard(r, examName), html: doc.html, readingMinutes: doc.readingMinutes };
};

function assertPublishable(p: { published?: boolean; body?: string; fileId?: string | null }) {
	if (p.published && !p.body?.trim() && !p.fileId) throw new DomainError(422, 'Write the post or attach a PDF before publishing.');
}

const slugTaken = async (s: string) => Boolean((await db().select({ id: posts.id }).from(posts).where(eq(posts.slug, s)).limit(1)).length);

async function load(id: string): Promise<Row> {
	if (!UUID.test(id)) throw new DomainError(404, 'Post not found.');
	const [r] = await db().select().from(posts).where(eq(posts.id, id));
	if (!r) throw new DomainError(404, 'Post not found.');
	return r;
}

// ---------- staff ----------

export async function listPostsAdmin(f: { kind?: PostKind; limit?: number } = {}): Promise<(PostCard & { published: boolean })[]> {
	const rows = await db()
		.select({ p: posts, examName: exams.name })
		.from(posts)
		.leftJoin(exams, eq(exams.id, posts.examId))
		.where(f.kind ? eq(posts.kind, f.kind) : undefined)
		.orderBy(desc(posts.publishedOn), desc(posts.createdAt))
		.limit(f.limit ?? 200);
	return rows.map((r) => toCard(r.p, r.examName));
}

export const getPost = async (id: string): Promise<PostDTO> => toDTO(await load(id));

export async function createPost(raw: unknown): Promise<PostDTO> {
	const input = postInput.parse(raw);
	assertPublishable(input);
	const slug = await uniqueSlug(input.title, slugTaken);
	const [r] = await db().insert(posts).values({ ...input, slug }).returning();
	return toDTO(r);
}

/** Only keys present in the input change. The slug stays put so shared links keep working. */
export async function updatePost(id: string, raw: unknown): Promise<PostDTO> {
	const cur = await load(id);
	const patch = Object.fromEntries(Object.entries(postPatch.parse(raw)).filter(([, v]) => v !== undefined));
	if (!Object.keys(patch).length) return toDTO(cur);
	assertPublishable({ ...cur, ...patch });
	const [r] = await db().update(posts).set(patch).where(eq(posts.id, id)).returning();
	return toDTO(r);
}

export const setPostPublished = (id: string, on: boolean) => updatePost(id, { published: on });

/** The quiz test (if any) stays; it is a normal test the staff can archive. */
export async function deletePost(id: string) {
	await db().delete(posts).where(eq(posts.id, id));
}

/** Removes a published job alert that was created from an announcement. Missing slugs are ignored. */
export async function deleteJobAlertBySlug(slug: string) {
	const [r] = await db().select({ id: posts.id }).from(posts).where(and(eq(posts.kind, 'job_alert'), eq(posts.slug, slug)));
	if (r) await deletePost(r.id);
}

// ---------- daily quiz ----------

/** Starts an AI run that drafts the quiz from the post text. Kept small: title as topic, plain text clamped as context. */
export async function startQuiz(postId: string, userId: string): Promise<string> {
	const p = await load(postId);
	const text = plainText(p.body, 900);
	if (text.length < 80) throw new DomainError(422, 'Write at least a few lines of current affairs first; the quiz is drafted from them.');
	const examName = p.examId ? ((await db().select({ name: exams.name }).from(exams).where(eq(exams.id, p.examId)))[0]?.name ?? '') : '';
	const job = await createJob(
		{
			mode: 'topic',
			topic: `Current affairs ${fmtDay(p.publishedOn, { day: 'numeric', month: 'long', year: 'numeric' })}`,
			count: QUIZ_SIZE,
			difficulty: 'mixed',
			examName,
			instructions: `Plain text only, no LaTeX or $ signs. Ask only about facts stated in this text: ${text}`
		},
		userId
	);
	return job.id;
}

/**
 * Applies the reviewed questions: new bank module "Current affairs <date>", a published daily test of them,
 * linked to the post as its quiz. Returns the test id.
 */
export async function publishQuiz(postId: string, jobId: string, items: unknown[], userId: string): Promise<string> {
	const p = await load(postId);
	if (p.quizTestId) throw new DomainError(409, 'This post already has a quiz.');
	if (!items.length) throw new DomainError(400, 'Accept at least one question.');
	const job = await getJob(jobId);
	if (job.status !== 'ready') throw new DomainError(409, job.status === 'applied' ? 'These questions were already used.' : 'The draft is not finished yet.');

	const day = fmtDay(p.publishedOn, { day: 'numeric', month: 'short', year: 'numeric' });
	const mod = await createModule({ name: `Current affairs ${day}`, examId: p.examId }, userId);
	const report = await applyGenerated(mod.id, items, 'ai_topic', userId);
	await markApplied(job.id);
	if (!report.ids.length) throw new DomainError(422, 'Every accepted question was invalid or already in the bank. Generate again.');

	const session = await currentSession();
	const { test } = await createTest(
		{
			title: `Daily quiz: ${day}`,
			kind: 'daily',
			examId: p.examId,
			sessionId: session?.id,
			durationMin: Math.max(5, report.ids.length),
			description: p.title,
			showSolutions: true
		},
		userId
	);
	await addQuestions(test.id, report.ids);
	await publishTest(test.id);
	await db().update(posts).set({ quizTestId: test.id }).where(eq(posts.id, postId));
	return test.id;
}

// ---------- public + student ----------

const live = (kind: PostKind) => and(eq(posts.kind, kind), eq(posts.published, true), lte(posts.publishedOn, istDate()));

export async function listPublished(kind: PostKind, limit = 60): Promise<PostCard[]> {
	const rows = await db()
		.select({ p: posts, examName: exams.name })
		.from(posts)
		.leftJoin(exams, eq(exams.id, posts.examId))
		.where(live(kind))
		.orderBy(desc(posts.publishedOn), desc(posts.createdAt))
		.limit(limit);
	return rows.map((r) => toCard(r.p, r.examName));
}

export async function publishedBySlug(kind: PostKind, slug: string): Promise<PostPage> {
	const [r] = await db()
		.select({ p: posts, examName: exams.name })
		.from(posts)
		.leftJoin(exams, eq(exams.id, posts.examId))
		.where(and(live(kind), eq(posts.slug, slug)))
		.limit(1);
	if (!r) throw new DomainError(404, 'Post not found.');
	return toPage(r.p, r.examName);
}

/** Exams that have a published syllabus page. */
export async function syllabusExams(): Promise<{ slug: string; name: string; title: string }[]> {
	return db()
		.selectDistinctOn([exams.id], { slug: exams.slug, name: exams.name, title: posts.title })
		.from(posts)
		.innerJoin(exams, eq(exams.id, posts.examId))
		.where(live('syllabus'))
		.orderBy(exams.id, desc(posts.publishedOn));
}

/** The latest published syllabus post for an exam slug. */
export async function syllabusFor(examSlug: string): Promise<PostPage & { examSlug: string }> {
	const [r] = await db()
		.select({ p: posts, examName: exams.name })
		.from(posts)
		.innerJoin(exams, eq(exams.id, posts.examId))
		.where(and(live('syllabus'), eq(exams.slug, examSlug)))
		.orderBy(desc(posts.publishedOn))
		.limit(1);
	if (!r) throw new DomainError(404, 'No syllabus for this exam yet.');
	return { ...toPage(r.p, r.examName), examSlug };
}

/** IST days on which the user finished a daily quiz (submitted or timed out), recent first. */
async function quizDays(userId: string, since: string): Promise<string[]> {
	const day = sql<string>`to_char(${attempts.submittedAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`;
	const rows = await db()
		.selectDistinct({ day })
		.from(attempts)
		.innerJoin(tests, eq(tests.id, attempts.testId))
		.where(
			and(
				eq(attempts.userId, userId),
				eq(tests.kind, 'daily'),
				ne(attempts.status, 'in_progress'),
				gte(attempts.submittedAt, new Date(Date.parse(since + 'T00:00:00+05:30')))
			)
		);
	return rows.map((r) => r.day);
}

export type QuizState = { testId: string; status: 'todo' | 'in_progress' | 'done'; attemptId: string | null; score: number | null };

async function quizState(userId: string, testId: string | null): Promise<QuizState | null> {
	if (!testId) return null;
	const [t] = await db().select({ status: tests.status }).from(tests).where(eq(tests.id, testId));
	if (t?.status !== 'published') return null;
	const [a] = await db()
		.select({ id: attempts.id, status: attempts.status, score: attempts.score })
		.from(attempts)
		.where(and(eq(attempts.userId, userId), eq(attempts.testId, testId)))
		.orderBy(desc(attempts.startedAt))
		.limit(1);
	if (!a) return { testId, status: 'todo', attemptId: null, score: null };
	return a.status === 'in_progress'
		? { testId, status: 'in_progress', attemptId: a.id, score: null }
		: { testId, status: 'done', attemptId: a.id, score: a.score == null ? null : Number(a.score) };
}

export type AffairItem = {
	id: string;
	slug: string;
	title: string;
	publishedOn: string;
	examName: string | null;
	quiz: QuizState | null;
};

export type DailyFeed = {
	today: string;
	/** YYYY-MM */
	month: string;
	months: { value: string; count: number }[];
	posts: AffairItem[];
	post: PostPage | null;
	quiz: QuizState | null;
	streak: number;
};

const MONTH = /^\d{4}-\d{2}$/;

/** Last calendar day of a YYYY-MM, as YYYY-MM-DD. */
function monthEnd(ym: string): string {
	const [y, m] = ym.split('-').map(Number);
	const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`;
	return daysBefore(next, 1);
}

/** /app/daily: months of published current affairs, the posts in the chosen month, and one open post. */
export async function dailyFeed(userId: string, month?: string | null, slug?: string | null): Promise<DailyFeed> {
	const today = istDate();
	const [dates, done] = await Promise.all([
		db()
			.select({ publishedOn: posts.publishedOn })
			.from(posts)
			.where(live('current_affairs'))
			.orderBy(desc(posts.publishedOn)),
		quizDays(userId, daysBefore(today, 400))
	]);
	const counts = new Map<string, number>();
	for (const r of dates) {
		const key = r.publishedOn.slice(0, 7);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const months = [...counts.entries()].map(([value, count]) => ({ value, count }));
	const current = today.slice(0, 7);
	const picked = month && MONTH.test(month) && counts.has(month) ? month : counts.has(current) ? current : (months[0]?.value ?? current);
	const rows = await db()
		.select({ p: posts, examName: exams.name })
		.from(posts)
		.leftJoin(exams, eq(exams.id, posts.examId))
		.where(and(live('current_affairs'), gte(posts.publishedOn, `${picked}-01`), lte(posts.publishedOn, monthEnd(picked))))
		.orderBy(desc(posts.publishedOn), desc(posts.createdAt));
	const items: AffairItem[] = await Promise.all(
		rows.map(async (r) => ({
			id: r.p.id,
			slug: r.p.slug,
			title: r.p.title,
			publishedOn: r.p.publishedOn,
			examName: r.examName,
			quiz: await quizState(userId, r.p.quizTestId)
		}))
	);
	const hit = slug ? rows.find((r) => r.p.slug === slug) : undefined;
	return {
		today,
		month: picked,
		months,
		posts: items,
		post: hit ? toPage(hit.p, hit.examName) : null,
		quiz: hit ? await quizState(userId, hit.p.quizTestId) : null,
		streak: streakFrom(new Set(done), today)
	};
}

/** For the Today page: today's current-affairs post (if published), its quiz state and the daily-quiz streak. */
export async function todayFor(userId: string): Promise<{ post: { title: string; slug: string; publishedOn: string } | null; quiz: QuizState | null; streak: number }> {
	const today = istDate();
	const [[p], done] = await Promise.all([
		db()
			.select({ title: posts.title, slug: posts.slug, publishedOn: posts.publishedOn, quizTestId: posts.quizTestId })
			.from(posts)
			.where(and(live('current_affairs'), eq(posts.publishedOn, today)))
			.orderBy(desc(posts.createdAt))
			.limit(1),
		quizDays(userId, daysBefore(today, 400))
	]);
	return {
		post: p ? { title: p.title, slug: p.slug, publishedOn: p.publishedOn } : null,
		quiz: p ? await quizState(userId, p.quizTestId) : null,
		streak: streakFrom(done, today)
	};
}
