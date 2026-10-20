// Notes (markdown + optional PDF) and per-user bookmarks. Drizzle lives only here.
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { noteBookmarks, notes, type User } from '../../../server/db/schema';
import { cached, cacheKeys, invalidate } from '../../../server/cache/index';
import { DomainError, isStaff } from '../../../server/http';
import { uniqueSlug } from '../../courses/server/slug';
import { userBatchIds } from '../../cohorts/server/service';
import { noteInput, noteUpdate, type NoteCard, type NoteDTO, type NoteFilter } from '../schema';
import { readingMinutes, renderDoc } from './markdown';
import type { z } from 'zod';

type Viewer = Pick<User, 'id' | 'role'>;
type NoteRow = typeof notes.$inferSelect;
const TTL = 300;

const toCard = (n: NoteRow): NoteCard => ({
	id: n.id,
	slug: n.slug,
	title: n.title,
	summary: n.summary,
	examId: n.examId,
	subjectId: n.subjectId,
	batchId: n.batchId,
	hasPdf: Boolean(n.fileId),
	isPaid: n.isPaid,
	readingMinutes: readingMinutes(n.body),
	updatedAt: n.updatedAt.toISOString()
});
const toDTO = (n: NoteRow): NoteDTO => {
	const doc = renderDoc(n.body);
	return { ...toCard(n), body: n.body, html: doc.html, toc: doc.toc, fileId: n.fileId, published: n.published, createdAt: n.createdAt.toISOString() };
};

async function bust(id: string) {
	const [n] = await db().select({ slug: notes.slug }).from(notes).where(eq(notes.id, id));
	await invalidate(cacheKeys.notesIndex, ...(n ? [cacheKeys.note(n.slug)] : []));
}

// ---------- staff ----------
export async function listNotesAdmin(f: NoteFilter & { published?: boolean } = {}) {
	const conds = [];
	if (f.q) conds.push(or(ilike(notes.title, `%${f.q}%`), ilike(notes.summary, `%${f.q}%`)));
	if (f.examId) conds.push(eq(notes.examId, f.examId));
	if (f.subjectId) conds.push(eq(notes.subjectId, f.subjectId));
	if (f.published !== undefined) conds.push(eq(notes.published, f.published));
	const rows = await db().select().from(notes).where(conds.length ? and(...conds) : undefined).orderBy(desc(notes.updatedAt));
	return rows.map((n) => ({ ...toCard(n), published: n.published }));
}

export async function getNoteAdmin(id: string): Promise<NoteDTO> {
	const [n] = await db().select().from(notes).where(eq(notes.id, id));
	if (!n) throw new DomainError(404, 'Note not found.');
	return toDTO(n);
}

export async function createNote(raw: z.input<typeof noteInput>) {
	const input = noteInput.parse(raw);
	const slug = await uniqueSlug(input.title, async (s) =>
		Boolean((await db().select({ id: notes.id }).from(notes).where(eq(notes.slug, s)).limit(1)).length)
	);
	const [row] = await db().insert(notes).values({ ...input, slug }).returning({ id: notes.id, slug: notes.slug });
	return row!;
}

export async function updateNote(id: string, raw: z.input<typeof noteUpdate>) {
	const input = noteUpdate.parse(raw);
	const [row] = await db().update(notes).set(input).where(eq(notes.id, id)).returning({ id: notes.id });
	if (!row) throw new DomainError(404, 'Note not found.');
	await bust(id);
}

export async function setNotePublished(id: string, published: boolean) {
	const [row] = await db().update(notes).set({ published }).where(eq(notes.id, id)).returning({ body: notes.body, fileId: notes.fileId });
	if (!row) throw new DomainError(404, 'Note not found.');
	await bust(id);
}

export async function deleteNote(id: string) {
	await bust(id);
	await db().delete(notes).where(eq(notes.id, id));
}

// ---------- students ----------
/** Every published note card (batch-only included; filtered per viewer below). */
const index = () =>
	cached(cacheKeys.notesIndex, TTL, async () =>
		(await db().select().from(notes).where(eq(notes.published, true)).orderBy(desc(notes.updatedAt))).map(toCard)
	);

/** Published note with rendered HTML + TOC (no per-user state). */
const published = (slug: string) =>
	cached(cacheKeys.note(slug), TTL, async () => {
		const [n] = await db()
			.select()
			.from(notes)
			.where(and(eq(notes.slug, slug), eq(notes.published, true)));
		return n ? toDTO(n) : undefined;
	});

const visible = (viewer: Viewer, batchId: string | null, mine: Set<string>) => !batchId || isStaff(viewer) || mine.has(batchId);

/** ponytail: filters the cached index in memory; fine to a few thousand notes, move search to SQL/FTS past that. */
export async function notesForUser(viewer: Viewer, f: NoteFilter = {}) {
	const mine = new Set(await userBatchIds(viewer.id));
	const saved = await bookmarkedIds(viewer.id);
	const q = f.q?.toLowerCase();
	return (await index())
		.filter(
			(n) =>
				visible(viewer, n.batchId, mine) &&
				(!f.examId || n.examId === f.examId) &&
				(!f.subjectId || n.subjectId === f.subjectId) &&
				(!f.bookmarked || saved.has(n.id)) &&
				(!q || n.title.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q))
		)
		.map((n) => ({ ...n, bookmarked: saved.has(n.id) }));
}

/** Public notes (no batch restriction) for the site; no viewer needed. */
export const publicNotes = async () => (await index()).filter((n) => !n.batchId);

export async function noteForUser(viewer: Viewer, slug: string) {
	const n = await published(slug);
	if (!n || !visible(viewer, n.batchId, new Set(await userBatchIds(viewer.id)))) throw new DomainError(404, 'Note not found.');
	return { ...n, bookmarked: (await bookmarkedIds(viewer.id)).has(n.id) };
}

// ---------- bookmarks ----------
async function bookmarkedIds(userId: string) {
	const rows = await db().select({ id: noteBookmarks.noteId }).from(noteBookmarks).where(eq(noteBookmarks.userId, userId));
	return new Set(rows.map((r) => r.id));
}

export async function setBookmark(userId: string, noteId: string, on: boolean) {
	if (on) await db().insert(noteBookmarks).values({ userId, noteId }).onConflictDoNothing();
	else await db().delete(noteBookmarks).where(and(eq(noteBookmarks.userId, userId), eq(noteBookmarks.noteId, noteId)));
	return on;
}

export async function toggleBookmark(userId: string, noteId: string) {
	return setBookmark(userId, noteId, !(await bookmarkedIds(userId)).has(noteId));
}
