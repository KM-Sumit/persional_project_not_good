import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { cacheKeys, cached } from '$lib/server/cache';
import { db } from '$lib/server/db';
import { banners, chapters, courses, lessonProgress, lessons, notes, questions, tests } from '$lib/server/db/schema';

export type BannerCard = {
	id: string;
	title: string;
	subtitle: string;
	ctaLabel: string;
	href: string | null;
};

export type CourseCard = {
	id: string;
	title: string;
	description: string;
	instructor: string;
	exam: string;
	lessonCount: number;
	durationMinutes: number;
};

export type NoteCard = {
	id: string;
	title: string;
	description: string;
	subject: string;
	exam: string;
};

export type TestCard = {
	id: string;
	title: string;
	subject: string;
	topic: string;
	questionCount: number;
	durationMinutes: number;
	difficulty: string;
	testType: 'practice' | 'mock' | 'pyq' | 'scheduled';
	accessType: 'free' | 'password' | 'paid';
	joinCode: string | null;
	chapterId: string | null;
	chapterTitle: string | null;
	courseTitle: string | null;
	marksPerQuestionMilli: number;
	negativeMilli: number;
	language: string;
};

export type ContinueLearning = {
	courseId: string;
	title: string;
	completed: number;
	total: number;
};

export type CourseDetail = {
	id: string;
	title: string;
	description: string;
	instructor: string;
	exam: string;
	durationMinutes: number;
	chapters: {
		id: string;
		title: string;
		lessons: {
			id: string;
			title: string;
			kind: 'text' | 'video' | 'pdf';
			durationMinutes: number;
			resourceUrl: string;
			body: string;
			completed: boolean;
		}[];
		tests: { id: string; title: string; durationMinutes: number }[];
	}[];
};

export type NoteDetail = {
	id: string;
	title: string;
	description: string;
	body: string;
	subject: string;
	exam: string;
	pdfUrl: null;
};

type PublicCourse = Omit<CourseDetail, 'chapters'> & {
	chapters: {
		id: string;
		title: string;
		lessons: Omit<CourseDetail['chapters'][number]['lessons'][number], 'completed'>[];
		tests: CourseDetail['chapters'][number]['tests'];
	}[];
};

export function listBanners() {
	return cached(cacheKeys.banners(), 60, () =>
		db()
			.select({
				id: banners.id,
				title: banners.title,
				subtitle: banners.subtitle,
				ctaLabel: banners.ctaLabel,
				href: banners.href
			})
			.from(banners)
			.where(eq(banners.enabled, true))
			.orderBy(asc(banners.sortOrder))
	);
}

export function listCourses() {
	return cached(cacheKeys.courses(), 60, () =>
		db()
			.select({
				id: courses.id,
				title: courses.title,
				description: courses.description,
				instructor: courses.instructor,
				exam: courses.exam,
				lessonCount: courses.lessonCount,
				durationMinutes: courses.durationMinutes
			})
			.from(courses)
			.where(eq(courses.published, true))
			.orderBy(desc(courses.createdAt))
	);
}

export function listNotes() {
	return cached(cacheKeys.notes(), 60, () =>
		db()
			.select({
				id: notes.id,
				title: notes.title,
				description: notes.description,
				subject: notes.subject,
				exam: notes.exam
			})
			.from(notes)
			.where(eq(notes.published, true))
			.orderBy(desc(notes.createdAt))
	);
}

export function listTests() {
	return cached(cacheKeys.tests(), 60, async (): Promise<TestCard[]> => {
		const rows = await db()
			.select({
				id: tests.id,
				title: tests.title,
				subject: tests.subject,
				topic: tests.topic,
				questionCount: sql<number>`count(${questions.id})::int`,
				durationMinutes: tests.durationMinutes,
				difficulty: tests.difficulty,
				testType: tests.testType,
				accessType: tests.accessType,
				joinCode: tests.joinCode,
				chapterId: tests.chapterId,
				chapterTitle: chapters.title,
				courseTitle: courses.title,
				marksPerQuestionMilli: tests.marksPerQuestionMilli,
				negativeMilli: tests.negativeMilli,
				language: tests.language
			})
			.from(tests)
			.leftJoin(questions, eq(questions.testId, tests.id))
			.leftJoin(chapters, eq(chapters.id, tests.chapterId))
			.leftJoin(courses, eq(courses.id, chapters.courseId))
			.where(and(eq(tests.published, true), ne(tests.status, 'draft'), ne(tests.status, 'cancelled')))
			.groupBy(
				tests.id,
				tests.title,
				tests.subject,
				tests.topic,
				tests.durationMinutes,
				tests.difficulty,
				tests.testType,
				tests.accessType,
				tests.joinCode,
				tests.chapterId,
				chapters.title,
				courses.title,
				tests.marksPerQuestionMilli,
				tests.negativeMilli,
				tests.language,
				tests.createdAt
			)
			.orderBy(desc(tests.createdAt));
		return rows.map((row) => ({ ...row, questionCount: Number(row.questionCount) }));
	});
}

/** Published paper opened by the short code on the tests page. */
export async function testIdByCode(code: string): Promise<string | null> {
	const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
	if (normalized.length < 4) return null;
	const [row] = await db()
		.select({ id: tests.id })
		.from(tests)
		.where(
			and(
				eq(tests.joinCode, normalized),
				eq(tests.published, true),
				ne(tests.status, 'draft'),
				ne(tests.status, 'cancelled')
			)
		)
		.limit(1);
	return row?.id ?? null;
}

/** Latest published course this user has finished a lesson in. Not cached. */
export async function continueLearning(userId: string): Promise<ContinueLearning | null> {
	const [row] = await db()
		.select({
			courseId: courses.id,
			title: courses.title,
			total: courses.lessonCount,
			completed: sql<number>`count(*)::int`
		})
		.from(lessonProgress)
		.innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
		.innerJoin(chapters, eq(chapters.id, lessons.chapterId))
		.innerJoin(courses, eq(courses.id, chapters.courseId))
		.where(and(eq(lessonProgress.userId, userId), eq(courses.published, true)))
		.groupBy(courses.id, courses.title, courses.lessonCount)
		.orderBy(desc(sql`max(${lessonProgress.completedAt})`))
		.limit(1);
	if (!row) return null;
	return {
		courseId: row.courseId,
		title: row.title,
		completed: Number(row.completed),
		total: row.total
	};
}

async function publishedCourse(courseId: string): Promise<PublicCourse | null> {
	const [course] = await db()
		.select({
			id: courses.id,
			title: courses.title,
			description: courses.description,
			instructor: courses.instructor,
			exam: courses.exam,
			durationMinutes: courses.durationMinutes
		})
		.from(courses)
		.where(and(eq(courses.id, courseId), eq(courses.published, true)))
		.limit(1);
	if (!course) return null;

	const chapterRows = await db()
		.select({ id: chapters.id, title: chapters.title })
		.from(chapters)
		.where(eq(chapters.courseId, courseId))
		.orderBy(asc(chapters.sortOrder), asc(chapters.id));

	const lessonRows = chapterRows.length
		? await db()
				.select({
					id: lessons.id,
					chapterId: lessons.chapterId,
					title: lessons.title,
					kind: lessons.kind,
					durationMinutes: lessons.durationMinutes,
					resourceUrl: lessons.resourceUrl,
					body: lessons.body
				})
				.from(lessons)
				.where(
					inArray(
						lessons.chapterId,
						chapterRows.map((chapter) => chapter.id)
					)
				)
				.orderBy(asc(lessons.sortOrder), asc(lessons.id))
		: [];

	const chapterIds = chapterRows.map((chapter) => chapter.id);
	const testRows = chapterIds.length
		? await db()
				.select({
					id: tests.id,
					chapterId: tests.chapterId,
					title: tests.title,
					durationMinutes: tests.durationMinutes
				})
				.from(tests)
				.where(
					and(
						inArray(tests.chapterId, chapterIds),
						eq(tests.published, true),
						ne(tests.status, 'draft'),
						ne(tests.status, 'cancelled')
					)
				)
				.orderBy(asc(tests.createdAt), asc(tests.id))
		: [];

	return {
		...course,
		chapters: chapterRows.map((chapter) => ({
			id: chapter.id,
			title: chapter.title,
			lessons: lessonRows
				.filter((lesson) => lesson.chapterId === chapter.id)
				.map((lesson) => ({
					id: lesson.id,
					title: lesson.title,
					kind: lesson.kind,
					durationMinutes: lesson.durationMinutes,
					resourceUrl: lesson.resourceUrl,
					body: lesson.body
				})),
			tests: testRows
				.filter((test) => test.chapterId === chapter.id)
				.map((test) => ({
					id: test.id,
					title: test.title,
					durationMinutes: test.durationMinutes
				}))
		}))
	};
}

export async function courseDetail(userId: string, courseId: string): Promise<CourseDetail | null> {
	const course = await cached(cacheKeys.course(courseId), 60, () => publishedCourse(courseId));
	if (!course) return null;

	const lessonIds = course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id));
	const done = new Set<string>();
	if (lessonIds.length > 0) {
		const rows = await db()
			.select({ lessonId: lessonProgress.lessonId })
			.from(lessonProgress)
			.where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.lessonId, lessonIds)));
		for (const row of rows) done.add(row.lessonId);
	}

	return {
		id: course.id,
		title: course.title,
		description: course.description,
		instructor: course.instructor,
		exam: course.exam,
		durationMinutes: course.durationMinutes,
		chapters: course.chapters.map((chapter) => ({
			id: chapter.id,
			title: chapter.title,
			lessons: chapter.lessons.map((lesson) => ({
				...lesson,
				completed: done.has(lesson.id)
			})),
			tests: chapter.tests
		}))
	};
}

/** Records completion when the lesson belongs to a published course. Already-complete is a no-op. */
export async function completeLesson(userId: string, lessonId: string): Promise<void> {
	const [lesson] = await db()
		.select({ id: lessons.id })
		.from(lessons)
		.innerJoin(chapters, eq(chapters.id, lessons.chapterId))
		.innerJoin(courses, eq(courses.id, chapters.courseId))
		.where(and(eq(lessons.id, lessonId), eq(courses.published, true)))
		.limit(1);
	if (!lesson) return;
	await db().insert(lessonProgress).values({ userId, lessonId }).onConflictDoNothing();
}

export async function noteDetail(id: string): Promise<NoteDetail | null> {
	return cached(cacheKeys.note(id), 60, async () => {
		const [note] = await db()
			.select({
				id: notes.id,
				title: notes.title,
				description: notes.description,
				body: notes.body,
				subject: notes.subject,
				exam: notes.exam
			})
			.from(notes)
			.where(and(eq(notes.id, id), eq(notes.published, true)))
			.limit(1);
		if (!note) return null;
		return { ...note, pdfUrl: null };
	});
}
