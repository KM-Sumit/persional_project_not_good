import { fail } from '@sveltejs/kit';
import { coursePaywall, lockedPoster, stripLocked } from '#lib/features/billing/server/paywall';
import { lessonForUser, saveLessonProgress } from '#lib/features/courses/server/service';
import { renderMarkdown } from '#lib/features/notes/server/markdown';
import { requireUser, toHttp } from '#lib/server/http';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const u = requireUser(event);
	const raw = await lessonForUser(u, event.params.slug, event.params.lessonId).catch(toHttp);
	const paywall = await coursePaywall(u.id, raw.course);
	// Locked: only preview lessons keep media and text; the rest never reach the browser.
	const page = paywall.locked ? { ...raw, course: stripLocked(raw.course), lesson: stripLocked({ chapters: [{ lessons: [raw.lesson] }] }).chapters[0]!.lessons[0]! } : raw;
	const locked = paywall.locked && !page.lesson.isPreview;
	const poster = locked && raw.lesson.kind === 'video' ? await lockedPoster(raw.lesson.youtubeId) : null;
	return { ...page, paywall, locked, poster, html: page.lesson.body.trim() ? renderMarkdown(page.lesson.body) : '' };
};

const progressForm = z.object({
	positionSec: z.coerce.number().int().min(0).max(86_400).optional(),
	completed: z.enum(['true', 'false']).optional()
});

export const actions: Actions = {
	/** Resume point (every ~15 s while a video plays) and completion. */
	progress: async (event) => {
		const u = requireUser(event);
		const r = progressForm.safeParse(Object.fromEntries(await event.request.formData()));
		if (!r.success) return fail(400, { message: 'Bad progress.' });
		const progress = await saveLessonProgress(u, event.params.lessonId, {
			positionSec: r.data.positionSec,
			completed: r.data.completed === undefined ? undefined : r.data.completed === 'true'
		}).catch(toHttp);
		return { progress, completed: r.data.completed };
	}
};
