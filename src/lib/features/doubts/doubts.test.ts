import { afterAll, beforeAll, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { users } from '#lib/server/db/schema';
import { askInput } from './schema';
import { draftAnswer, promptOf, textOf } from './server/ai';
import { answer, ask, draftContext, getForStaff, getMine, listMine, queue, saveDraft, unreadAnswers } from './server/service';

const tag = crypto.randomUUID().slice(0, 8);
let student = '';
let staff = '';

beforeAll(async () => {
	const rows = await db()
		.insert(users)
		.values([
			{ email: `doubt-s-${tag}@uci.test`, name: `Doubt Student ${tag}` },
			{ email: `doubt-t-${tag}@uci.test`, name: 'Doubt Teacher', role: 'teacher' }
		])
		.returning({ id: users.id });
	[student, staff] = rows.map((r) => r.id) as [string, string];
});

afterAll(async () => {
	// doubts cascade with the student
	for (const id of [student, staff]) if (id) await db().delete(users).where(eq(users.id, id));
});

test('ask input trims, rejects short text, treats empty link ids as none', () => {
	expect(askInput.safeParse({ body: 'hi' }).success).toBe(false);
	const ok = askInput.parse({ body: '  why is 0! = 1?  ', lessonId: '', questionId: '' });
	expect(ok).toEqual({ body: 'why is 0! = 1?', lessonId: undefined, questionId: undefined });
	expect(askInput.safeParse({ body: 'valid doubt', lessonId: 'nope' }).success).toBe(false);
});

test('prompt carries only context + doubt; text extraction skips thinking parts', () => {
	expect(promptOf('Why?', 'Lesson: Ratios')).toBe('Lesson: Ratios\nDoubt: Why?');
	expect(promptOf('Why?', null)).toBe('Doubt: Why?');
	expect(textOf([{ type: 'thinking', thinking: 'x' }, { type: 'text', text: 'Answer' }])).toBe('Answer');
	expect(textOf(' plain ')).toBe('plain');
});

test('draft falls back to the next model and fails cleanly when all fail', async () => {
	const bad = { name: 'bad', invoke: async () => Promise.reject(new Error('429')) };
	const good = { name: 'good', invoke: async () => ({ content: 'Use $a^2$.' }) };
	expect(await draftAnswer('doubt text', null, [bad, good])).toBe('Use $a^2$.');
	await expect(draftAnswer('doubt text', null, [bad])).rejects.toThrow('could not draft');
	await expect(draftAnswer('doubt text', null, [])).rejects.toThrow('not configured');
});

test('ask -> queue -> answer -> student reads (answered -> closed)', async () => {
	const { id } = await ask(student, { body: `How to find LCM fast? ${tag}`, lessonId: crypto.randomUUID() });
	await ask(student, { body: `Second doubt ${tag}` });

	const mine = await listMine(student);
	expect(mine.items.map((d) => d.status)).toEqual(['open', 'open']);
	expect(mine.items[1]!.lessonId).toBeNull(); // missing lesson link dropped, doubt kept

	const open = await queue({ filter: 'open', q: tag });
	expect(open.items.length).toBe(2);
	expect(open.items[0]!.student.name).toBe(`Doubt Student ${tag}`);
	expect((await queue({ filter: 'answered', q: tag })).items.length).toBe(0);
	expect((await draftContext(id)).body).toContain('LCM');

	await saveDraft(id, 'AI says: prime factors.');
	await answer(id, staff, { answer: 'List prime factors, take the **highest** powers.' });
	const s = await getForStaff(id);
	expect(s.aiDraft).toBe('AI says: prime factors.');
	expect(s.answeredBy).toBe('Doubt Teacher');
	expect(await unreadAnswers(student)).toBe(1);

	const read = await getMine(student, id);
	expect(read.unread).toBe(true); // this view still shows it as new
	expect(read.answerHtml).toContain('<strong>highest</strong>');
	expect(await unreadAnswers(student)).toBe(0);
	expect((await queue({ filter: 'answered', q: tag })).items[0]!.status).toBe('closed');

	await expect(getMine(staff, id)).rejects.toThrow('not found');
	await expect(answer(id, staff, { answer: '' })).rejects.toThrow();
});
