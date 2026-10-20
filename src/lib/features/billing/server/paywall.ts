// Paywall: who may open a paid course or note, and which product to offer when they may not. Free content is never locked.
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { courses, notes, users } from '#lib/server/db/schema';
import type { Paywall } from '../format';
import { hasAccess, offersFor } from './service';

const isStaffUser = async (userId: string) => {
	const [u] = await db().select({ role: users.role }).from(users).where(eq(users.id, userId));
	return u?.role === 'teacher' || u?.role === 'admin';
};

/** Free course, staff, an exam pass for the course's exam, or the course product. Unknown course = false. */
export async function courseAccess(userId: string, courseId: string) {
	const [c] = await db().select({ isPaid: courses.isPaid, examId: courses.examId }).from(courses).where(eq(courses.id, courseId));
	if (!c) return false;
	if (!c.isPaid) return true;
	return (await isStaffUser(userId)) || hasAccess(userId, { examId: c.examId, courseId });
}

/** Free note, staff, or an exam pass for the note's exam. Unknown note = false. */
export async function noteAccess(userId: string, noteId: string) {
	const [n] = await db().select({ isPaid: notes.isPaid, examId: notes.examId }).from(notes).where(eq(notes.id, noteId));
	if (!n) return false;
	if (!n.isPaid) return true;
	return (await isStaffUser(userId)) || (!!n.examId && hasAccess(userId, { examId: n.examId }));
}

/** Prefers the exam pass (unlocks more), else the cheapest other offer. */
async function offer(t: { examId: string | null; courseId?: string }): Promise<Paywall['offer']> {
	const list = await offersFor(t);
	const p = list.find((x) => x.kind === 'exam_pass') ?? list[0];
	return p
		? { id: p.id, kind: p.kind, title: p.title, targetName: p.targetName, priceInr: p.priceInr, mrpInr: p.mrpInr, validityDays: p.validityDays, validUntil: p.validUntil }
		: null;
}

export async function coursePaywall(userId: string, c: { id: string; examId: string | null }): Promise<Paywall> {
	if (await courseAccess(userId, c.id)) return { locked: false, offer: null };
	return { locked: true, offer: await offer({ examId: c.examId, courseId: c.id }) };
}

export async function notePaywall(userId: string, n: { id: string; examId: string | null }): Promise<Paywall> {
	if (await noteAccess(userId, n.id)) return { locked: false, offer: null };
	return { locked: true, offer: n.examId ? await offer({ examId: n.examId }) : null };
}

/**
 * Tiny blurred poster for a locked video as a data URI, fetched on the server so the YouTube id never reaches the
 * browser (an id is enough to watch the video on YouTube). 120x90 is plenty under a blur. Null on any failure.
 */
export async function lockedPoster(youtubeId: string | null) {
	if (!youtubeId || !/^[\w-]{11}$/.test(youtubeId)) return null;
	try {
		const r = await fetch(`https://i.ytimg.com/vi/${youtubeId}/default.jpg`, { signal: AbortSignal.timeout(2000) });
		if (!r.ok) return null;
		return `data:image/jpeg;base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
	} catch {
		return null;
	}
}

/** Removes media and text from every lesson that is not a preview, so locked content never reaches the browser. */
export function stripLocked<L extends { isPreview: boolean; youtubeId: string | null; body: string; fileId: string | null }, C extends { chapters: { lessons: L[] }[] }>(
	course: C
): C {
	return {
		...course,
		chapters: course.chapters.map((ch) => ({ ...ch, lessons: ch.lessons.map((l) => (l.isPreview ? l : { ...l, youtubeId: null, body: '', fileId: null })) }))
	};
}

/**
 * The first part of a markdown note for a locked teaser: whole blocks up to ~25% of the text (at least one block,
 * at most 1500 chars). ponytail: splits on blank lines, so a fenced block with blank lines inside may be cut; fine for a teaser.
 */
export function teaserMarkdown(md: string) {
	const blocks = md.split(/\n\s*\n/);
	const budget = Math.min(1500, Math.max(300, md.length * 0.25));
	const out: string[] = [];
	let n = 0;
	for (const b of blocks) {
		if (out.length && n + b.length > budget) break;
		out.push(b);
		n += b.length;
	}
	return out.join('\n\n');
}
