// Pure helpers + DB tests against the local database (rows tagged with a run id, deleted in afterAll).
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { inArray, like } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { modules, questions, testQuestions, tests } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import { fingerprint } from './fingerprint';
import { decodeCursor, encodeCursor, parseCsv, toCsv } from './util';
import {
	applyGenerated,
	createModule,
	createQuestion,
	csvToRows,
	deleteModule,
	deleteQuestion,
	getModule,
	importQuestions,
	listModules,
	moveQuestions,
	searchQuestions,
	updateQuestion
} from './service';

setDefaultTimeout(30_000);
const rid = crypto.randomUUID().slice(0, 8);
const moduleIds: string[] = [];

const status = async (p: Promise<unknown>) => {
	try {
		await p;
	} catch (e) {
		if (e instanceof DomainError) return e.status;
		throw e;
	}
	return 200;
};

describe('pure helpers', () => {
	test('fingerprint ignores case, punctuation and spacing', () => {
		expect(fingerprint('What is  2+2?')).toBe(fingerprint('what is 2 2'));
		expect(fingerprint('What is 2+2?')).not.toBe(fingerprint('What is 2+3?'));
	});
	test('csv parse handles quotes, commas, newlines, BOM', () => {
		expect(parseCsv('﻿a,b\r\n"x, y","he said ""hi"""\n"multi\nline",z\n\n')).toEqual([
			['a', 'b'],
			['x, y', 'he said "hi"'],
			['multi\nline', 'z']
		]);
	});
	test('csv export escapes and neutralises formulas', () => {
		expect(toCsv([['a,b', '=SUM(A1)', -3, null]])).toBe('"a,b",\'=SUM(A1),-3,\r\n');
	});
	test('csv rows map headers to questions', () => {
		const [r] = csvToRows('Question,A,B,C,Answer,Topic,Difficulty\nWhat?,x,y,z,B,T,Hard');
		expect(r).toEqual({ prompt: 'What?', options: ['x', 'y', 'z'], correctIndex: 1, topic: 'T', difficulty: 'hard' });
		expect(csvToRows('prompt,option_1,option_2,correct\nQ,a,b,2')[0].correctIndex).toBe(1);
	});
	test('cursor round trip, junk rejected', () => {
		const c = encodeCursor('2026-10-20 10:00:00.123456+00', '0b8f1c4e-7a1d-4c4e-9f1a-1d2e3f4a5b6c');
		expect(decodeCursor(c)).toEqual({ ts: '2026-10-20 10:00:00.123456+00', id: '0b8f1c4e-7a1d-4c4e-9f1a-1d2e3f4a5b6c' });
		expect(decodeCursor('bogus')).toBeNull();
		expect(decodeCursor(Buffer.from("1'; drop table x|abc").toString('base64url'))).toBeNull();
	});
});

describe('bank (db)', () => {
	let m1: string, m2: string;
	beforeAll(async () => {
		m1 = (await createModule({ name: `a4 ${rid} one` }, null)).id;
		m2 = (await createModule({ name: `a4 ${rid} two` }, null)).id;
		moduleIds.push(m1, m2);
	});
	afterAll(async () => {
		await db().delete(tests).where(like(tests.title, `a4 ${rid}%`));
		await db().delete(questions).where(like(questions.prompt, `%${rid}%`));
		await db().delete(modules).where(inArray(modules.id, moduleIds));
	});

	test('question CRUD + validation', async () => {
		expect(await status(createQuestion({ prompt: `${rid} bad`, options: ['a'], correctIndex: 0 }, { actorId: null }))).toBe(400);
		expect(await status(createQuestion({ prompt: `${rid} bad`, options: ['a', 'b'], correctIndex: 2 }, { actorId: null }))).toBe(400);
		expect(await status(createQuestion({ prompt: `${rid} bad`, options: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], correctIndex: 0 }, { actorId: null }))).toBe(400);
		const q = await createQuestion({ prompt: `${rid} capital of France`, options: ['Paris', 'Rome'], correctIndex: 0, difficulty: 'easy' }, { moduleId: m1, actorId: null });
		expect(q).toMatchObject({ options: ['Paris', 'Rome'], source: 'manual', moduleId: m1 });
		expect(await status(updateQuestion(q.id, { correctIndex: 3 }))).toBe(400);
		const u = await updateQuestion(q.id, { options: ['Rome', 'Paris', 'Berlin'], correctIndex: 1 });
		expect(u.correctIndex).toBe(1);
		expect((await getModule(m1)).counts).toEqual({ easy: 1, medium: 0, hard: 0 });
	});

	test('JSON import: all-or-nothing on errors, duplicates skipped and reported', async () => {
		const good = [
			{ prompt: `${rid} json 1`, options: ['a', 'b', 'c', 'd'], correctIndex: 3, difficulty: 'hard' },
			{ prompt: `${rid} JSON 1!`, options: [{ text: 'a' }, { text: 'b' }], correctIndex: 0 }, // dup of row 1
			{ prompt: `${rid} capital of france`, options: ['x', 'y'], correctIndex: 0 } // dup of the bank
		];
		const bad = await importQuestions({ moduleId: m1, format: 'json', text: JSON.stringify([...good, { prompt: '', options: [] }]) }, null);
		expect(bad.inserted).toBe(0);
		expect(bad.errors[0].row).toBe(4);
		const ok = await importQuestions({ moduleId: m1, format: 'json', text: JSON.stringify(good) }, null);
		expect(ok.inserted).toBe(1);
		expect(ok.duplicates.map((d) => d.row)).toEqual([2, 3]);
		expect(await status(importQuestions({ moduleId: m1, format: 'json', text: '{nope' }, null))).toBe(400);
	});

	test('CSV import reports spreadsheet line numbers', async () => {
		const csv = `prompt,a,b,c,d,answer\n${rid} csv 1,a,b,c,d,C\n${rid} csv 2,a,,,,A\n`;
		const r = await importQuestions({ moduleId: m2, format: 'csv', text: csv }, null);
		expect(r.inserted).toBe(0);
		expect(r.errors[0].row).toBe(3);
		const r2 = await importQuestions({ moduleId: m2, format: 'csv', text: csv.replace(',a,,,,A', ',a,b,,,A') }, null);
		expect(r2.inserted).toBe(2);
	});

	test('applyGenerated skips bad items, tags the source', async () => {
		const r = await applyGenerated(m2, [{ prompt: `${rid} ai 1`, options: ['a', 'b'], correctIndex: 1 }, { prompt: 'x' }], 'ai_pdf', null);
		expect(r.inserted).toBe(1);
		expect(r.errors).toHaveLength(1);
		const page = await searchQuestions({ q: `${rid} ai`, limit: 10 });
		expect(page.items[0].source).toBe('ai_pdf');
	});

	test('search: filters + keyset paging; move; delete guarded by tests', async () => {
		const p1 = await searchQuestions({ q: rid, limit: 2 });
		expect(p1.items).toHaveLength(2);
		const p2 = await searchQuestions({ q: rid, limit: 2, cursor: p1.nextCursor });
		expect(p2.items.map((i) => i.id)).not.toContain(p1.items[0].id);
		const all = await searchQuestions({ q: rid, limit: 100 });
		expect(all.items.length).toBe(5);
		expect((await searchQuestions({ q: rid, difficulty: 'hard', moduleId: m1 })).items).toHaveLength(1);
		expect((await searchQuestions({ q: `${rid} 100%_` })).items).toHaveLength(0); // LIKE wildcards escaped

		const ids = (await searchQuestions({ q: rid, moduleId: m2 })).items.map((i) => i.id);
		expect(await moveQuestions({ ids, moduleId: m1 })).toBe(3);
		expect((await getModule(m1)).questionCount).toBe(5);
		expect((await listModules({ q: `a4 ${rid}` })).map((m) => m.questionCount)).toEqual([5, 0]);

		const [t] = await db().insert(tests).values({ title: `a4 ${rid} guard` }).returning();
		await db().insert(testQuestions).values({ testId: t.id, questionId: ids[0] });
		expect(await status(deleteQuestion(ids[0]))).toBe(409);
		await deleteQuestion(ids[1]);
		await deleteModule(m2);
		expect(await status(getModule(m2))).toBe(404);
	});
});
