import { fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createProduct, updateProduct } from '#lib/features/billing/server/service';
import { db } from '#lib/server/db';
import { products } from '#lib/server/db/schema';
import {
	addChapter,
	addLesson,
	deleteChapter,
	deleteCourse,
	deleteLesson,
	getCourseAdmin,
	reorderChapters,
	reorderLessons,
	setCoursePublished,
	updateChapter,
	updateCourse,
	updateLesson
} from '#lib/features/courses/server/service';
import { send } from '#lib/features/engage/server/service';
import { createTest, deleteTest, getTest, listTests, publishTest, unpublishTest } from '#lib/features/tests/server/service';
import { DomainError, requireStaff, toHttp } from '#lib/server/http';
import { attempt, courseFields, editorOptions, isPaidOf, str } from '../options.server';
import { ytInfo, ytThumb } from '../youtube.server';
import { lessonFields } from './lesson.server';
import type { Actions, PageServerLoad } from './$types';

async function courseProduct(courseId: string) {
	const [p] = await db()
		.select({ id: products.id, priceInr: products.priceInr, mrpInr: products.mrpInr, validityDays: products.validityDays })
		.from(products)
		.where(and(eq(products.kind, 'course'), eq(products.courseId, courseId)))
		.limit(1);
	return p ?? null;
}

export const load: PageServerLoad = async ({ params }) => {
	const [course, opts, tests, price] = await Promise.all([
		getCourseAdmin(params.id).catch(toHttp),
		editorOptions(),
		listTests({ courseId: params.id, limit: 50 }),
		courseProduct(params.id)
	]);
	return { course: { ...course, paid: isPaidOf(course) }, tests: tests.items, price, ...opts };
};

async function ownTest(courseId: string, testId: string) {
	const t = await getTest(testId);
	if (t.courseId !== courseId) throw new DomainError(404, 'Test not found.');
	return t;
}

const ids = (fd: FormData) => z.array(z.uuid()).min(1).parse(JSON.parse(str(fd, 'ids') || '[]'));

/** Lessons need a chapter: the first one, or "Course content" on an empty course. */
async function chapterFor(courseId: string, chapterId: string) {
	if (chapterId) return chapterId;
	const c = await getCourseAdmin(courseId);
	return c.chapters[0]?.id ?? (await addChapter(courseId, { title: 'Course content' })).id;
}

/** No cover yet: use the first video's YouTube thumbnail. */
async function autoCover(courseId: string, youtubeId: string) {
	const c = await getCourseAdmin(courseId);
	if (!c.coverFileId && !c.coverUrl) await updateCourse(courseId, { coverUrl: ytThumb(youtubeId) });
}

/** What still blocks publishing, in plain words (empty = ready). */
function publishProblems(c: Awaited<ReturnType<typeof getCourseAdmin>>, hasPrice: boolean) {
	const all = c.chapters.flatMap((ch) => ch.lessons);
	const out: string[] = [];
	if (c.isPaid && !hasPrice) out.push('Set a price for this paid course.');
	if (!all.length) out.push('Add at least one lesson.');
	for (const l of all) {
		if (l.kind === 'video' && !l.youtubeId) out.push(`“${l.title}” needs a YouTube link.`);
		if (l.kind === 'pdf' && !l.fileId) out.push(`“${l.title}” needs a PDF.`);
		if (l.kind === 'reading' && !l.body.trim()) out.push(`“${l.title}” has no text.`);
	}
	return out;
}

export const actions: Actions = {
	save: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await updateCourse(event.params.id, courseFields(fd));
			return { message: 'Details saved' };
		});
	},
	savePrice: async (event) => {
		const user = requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			const course = await getCourseAdmin(event.params.id);
			if (!course.isPaid) throw new DomainError(422, 'Turn this into a paid course before setting a price.');
			const current = await courseProduct(course.id);
			const raw = {
				kind: 'course' as const,
				courseId: course.id,
				title: course.title,
				priceInr: str(fd, 'priceInr'),
				mrpInr: str(fd, 'mrpInr'),
				validityDays: str(fd, 'validityDays'),
				active: true
			};
			if (current) await updateProduct(current.id, raw, user.id);
			else await createProduct(raw, user.id);
			return { message: 'Price saved' };
		});
	},
	publish: async (event) => {
		const user = requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			const c = await getCourseAdmin(event.params.id);
			const problems = publishProblems(c, Boolean(await courseProduct(c.id)));
			if (problems.length) throw new DomainError(422, problems[0]!);
			await setCoursePublished(c.id, true);
			if (fd.get('notify') === 'on')
				await send({ title: `New course: ${c.title}`, body: c.summary, href: `/app/learn/${c.slug}`, batchId: c.batchId }, user.id);
			return { message: fd.get('notify') === 'on' ? 'Course published and students notified' : 'Course published' };
		});
	},
	unpublish: async (event) => {
		requireStaff(event);
		return attempt(async () => {
			await setCoursePublished(event.params.id, false);
			return { message: 'Course moved to drafts' };
		});
	},
	delete: async (event) => {
		requireStaff(event);
		await deleteCourse(event.params.id);
		redirect(303, '/admin/courses?deleted=1');
	},
	addTest: async (event) => {
		const user = requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			const course = await getCourseAdmin(event.params.id);
			await createTest(
				{
					title: str(fd, 'title'),
					durationMin: str(fd, 'durationMin') || 30,
					kind: 'practice',
					access: 'open',
					courseId: course.id,
					examId: course.examId
				},
				user.id
			);
			return { message: 'Test added to this course' };
		});
	},
	publishTest: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await ownTest(event.params.id, str(fd, 'testId'));
			await publishTest(str(fd, 'testId'));
			return { message: 'Test published on this course' };
		});
	},
	unpublishTest: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await ownTest(event.params.id, str(fd, 'testId'));
			await unpublishTest(str(fd, 'testId'));
			return { message: 'Test moved to draft' };
		});
	},
	deleteTest: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await ownTest(event.params.id, str(fd, 'testId'));
			await deleteTest(str(fd, 'testId'));
			return { message: 'Test removed' };
		});
	},
	addChapter: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await addChapter(event.params.id, { title: str(fd, 'title') });
			return { message: 'Chapter added' };
		});
	},
	renameChapter: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await updateChapter(str(fd, 'chapterId'), { title: str(fd, 'title') });
			return { message: 'Chapter renamed' };
		});
	},
	deleteChapter: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await deleteChapter(str(fd, 'chapterId'));
			return { message: 'Chapter deleted' };
		});
	},
	reorderChapters: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await reorderChapters(event.params.id, ids(fd));
			return { message: 'Order saved' };
		});
	},
	reorderLessons: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await reorderLessons(str(fd, 'chapterId'), ids(fd));
			return { message: 'Order saved' };
		});
	},
	addLesson: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			const input = await lessonFields(fd);
			const chapterId = await chapterFor(event.params.id, str(fd, 'chapterId'));
			await addLesson(chapterId, input);
			if (input.youtubeId) await autoCover(event.params.id, input.youtubeId);
			return { message: 'Lesson added' };
		});
	},
	bulkAdd: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		const lines = str(fd, 'links')
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean)
			.slice(0, 100);
		if (!lines.length) return fail(400, { message: 'Paste at least one YouTube link.' });
		// "Title | link" keeps the typed title; a bare link takes the YouTube title.
		const parsed = await Promise.all(
			lines.map(async (line) => {
				const [a, b] = line.includes('|') ? line.split('|').map((s) => s.trim()) : ['', line];
				const info = await ytInfo(b ?? '');
				return info ? { ...info, title: a || info.title } : null;
			})
		);
		const ok = parsed.filter((p) => p !== null);
		if (!ok.length) return fail(400, { message: 'None of those lines is a YouTube link.' });
		return attempt(async () => {
			const chapterId = await chapterFor(event.params.id, str(fd, 'chapterId'));
			const start = (await getCourseAdmin(event.params.id)).chapters.flatMap((c) => c.lessons).length;
			for (const [i, v] of ok.entries())
				await addLesson(chapterId, { kind: 'video', youtube: v.id, title: v.title || `Lesson ${start + i + 1}` });
			await autoCover(event.params.id, ok[0]!.id);
			const skipped = lines.length - ok.length;
			return { message: `Added ${ok.length} lesson${ok.length === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} line${skipped === 1 ? '' : 's'} that were not YouTube links` : ''}` };
		});
	},
	togglePreview: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			const on = fd.get('on') === 'true';
			await updateLesson(str(fd, 'lessonId'), { isPreview: on });
			return { message: on ? 'Free preview on' : 'Free preview off' };
		});
	},
	deleteLesson: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return attempt(async () => {
			await deleteLesson(str(fd, 'lessonId'));
			return { message: 'Lesson deleted' };
		});
	}
};
