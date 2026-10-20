import { afterAll, expect, test } from 'bun:test';
import { inArray } from 'drizzle-orm';
import { db } from '../../../server/db/index';
import { notes, users } from '../../../server/db/schema';
import * as svc from './service';

const tag = crypto.randomUUID().slice(0, 8);
const noteIds: string[] = [];
const userIds: string[] = [];
afterAll(async () => {
	if (noteIds.length) await db().delete(notes).where(inArray(notes.id, noteIds));
	if (userIds.length) await db().delete(users).where(inArray(users.id, userIds));
});

test('notes: CRUD, publish, filters, rendered body, bookmarks', async () => {
	const n = await svc.createNote({ title: `Percent ${tag}`, summary: 'quick sheet', body: '## Basics\n\n$x\\%$ of y' });
	noteIds.push(n.id);
	expect(n.slug).toBe(`percent-${tag}`);
	const [u] = await db().insert(users).values({ email: `notes-${tag}@test.local`, name: 'Reader' }).returning();
	userIds.push(u!.id);
	const viewer = { id: u!.id, role: 'student' as const };

	await expect(svc.noteForUser(viewer, n.slug)).rejects.toThrow('not found'); // draft
	await svc.setNotePublished(n.id, true);
	const full = await svc.noteForUser(viewer, n.slug);
	expect(full.toc).toEqual([{ id: 'basics', text: 'Basics', level: 2 }]);
	expect(full.html).toContain('katex');
	expect(full.bookmarked).toBe(false);

	expect((await svc.notesForUser(viewer, { q: tag.toUpperCase() })).map((x) => x.id)).toEqual([n.id]);
	expect(await svc.notesForUser(viewer, { q: `nomatch-${tag}` })).toEqual([]);

	expect(await svc.toggleBookmark(u!.id, n.id)).toBe(true);
	expect((await svc.notesForUser(viewer, { bookmarked: true })).map((x) => x.id)).toEqual([n.id]);
	expect(await svc.toggleBookmark(u!.id, n.id)).toBe(false);
	expect(await svc.notesForUser(viewer, { bookmarked: true })).toEqual([]);

	await svc.updateNote(n.id, { title: 'Renamed' });
	expect((await svc.noteForUser(viewer, n.slug)).title).toBe('Renamed'); // cache busted, slug stable
	expect((await svc.listNotesAdmin({ q: 'Renamed' })).some((x) => x.id === n.id)).toBe(true);
});
