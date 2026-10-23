// Question bank: modules (named pools), questions, import (JSON/CSV), AI output apply, search.
import { patchOf } from '#lib/zod.ts';
import { and, asc, count, desc, eq, ilike, inArray, isNull, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '#lib/server/db';
import { modules, questions, testQuestions } from '#lib/server/db/schema';
import { DomainError } from '#lib/server/http';
import {
	moduleInput,
	moveQuestionsInput,
	questionInput,
	questionPatch,
	questionSearch,
	type DifficultyCounts,
	type ImportReport,
	type ModuleDTO,
	type Page,
	type QuestionDTO,
	type QuestionSearch,
	type QuestionSource
} from '../schema';
import { fingerprint } from './fingerprint';
import { afterCursor, pageOf, parseCsv, tsText } from './util';

type QuestionRow = typeof questions.$inferSelect;
type ModuleRow = typeof modules.$inferSelect;

export const toQuestionDTO = (q: QuestionRow): QuestionDTO => ({
	id: q.id,
	moduleId: q.moduleId,
	prompt: q.prompt,
	options: q.options.map((o) => o.text),
	promptHi: q.promptHi,
	optionsHi: q.optionsHi?.map((o) => o.text) ?? null,
	explanationHi: q.explanationHi,
	correctIndex: q.correctIndex,
	explanation: q.explanation,
	topic: q.topic,
	difficulty: q.difficulty,
	imageFileId: q.imageFileId,
	source: q.source,
	createdAt: q.createdAt.toISOString(),
	updatedAt: q.updatedAt.toISOString()
});

const toModuleDTO = (m: ModuleRow, counts: DifficultyCounts): ModuleDTO => ({
	id: m.id,
	name: m.name,
	subjectId: m.subjectId,
	examId: m.examId,
	ownerId: m.ownerId,
	questionCount: counts.easy + counts.medium + counts.hard,
	counts,
	createdAt: m.createdAt.toISOString(),
	updatedAt: m.updatedAt.toISOString()
});

export const parse = <S extends z.ZodType>(schema: S, v: unknown): z.output<S> => {
	const r = schema.safeParse(v);
	if (!r.success) throw new DomainError(400, r.error.issues[0]?.message ?? 'Invalid input.');
	return r.data;
};

// ---------- modules ----------

async function difficultyCounts(moduleIds: string[]) {
	const out = new Map<string, DifficultyCounts>(moduleIds.map((id) => [id, { easy: 0, medium: 0, hard: 0 }]));
	if (!moduleIds.length) return out;
	const rows = await db()
		.select({ moduleId: questions.moduleId, difficulty: questions.difficulty, n: count() })
		.from(questions)
		.where(inArray(questions.moduleId, moduleIds))
		.groupBy(questions.moduleId, questions.difficulty);
	for (const r of rows) if (r.moduleId) out.get(r.moduleId)![r.difficulty] = r.n;
	return out;
}

export async function listModules(filter: { examId?: string; subjectId?: string; q?: string } = {}): Promise<ModuleDTO[]> {
	const where: SQL[] = [];
	if (filter.examId) where.push(eq(modules.examId, filter.examId));
	if (filter.subjectId) where.push(eq(modules.subjectId, filter.subjectId));
	if (filter.q) where.push(ilike(modules.name, `%${escapeLike(filter.q)}%`));
	const rows = await db()
		.select()
		.from(modules)
		.where(and(...where))
		.orderBy(asc(modules.name));
	const counts = await difficultyCounts(rows.map((m) => m.id));
	return rows.map((m) => toModuleDTO(m, counts.get(m.id)!));
}

export async function getModule(id: string): Promise<ModuleDTO> {
	const [m] = await db().select().from(modules).where(eq(modules.id, id)).limit(1);
	if (!m) throw new DomainError(404, 'Module not found.');
	return toModuleDTO(m, (await difficultyCounts([id])).get(id)!);
}

export async function createModule(input: unknown, actorId: string | null): Promise<ModuleDTO> {
	const data = parse(moduleInput, input);
	const [m] = await db()
		.insert(modules)
		.values({ ...data, ownerId: actorId })
		.returning();
	return toModuleDTO(m, { easy: 0, medium: 0, hard: 0 });
}

export async function updateModule(id: string, input: unknown): Promise<ModuleDTO> {
	const data = parse(patchOf(moduleInput), input);
	const [m] = await db().update(modules).set(data).where(eq(modules.id, id)).returning({ id: modules.id });
	if (!m) throw new DomainError(404, 'Module not found.');
	return getModule(id);
}

/** Deleting a module keeps its questions (they become unfiled), so tests built from it keep working. */
export async function deleteModule(id: string) {
	const [m] = await db().delete(modules).where(eq(modules.id, id)).returning({ id: modules.id });
	if (!m) throw new DomainError(404, 'Module not found.');
}

async function assertModule(moduleId: string | null | undefined) {
	if (!moduleId) return;
	const [m] = await db().select({ id: modules.id }).from(modules).where(eq(modules.id, moduleId)).limit(1);
	if (!m) throw new DomainError(404, 'Module not found.');
}

// ---------- questions ----------

export async function getQuestion(id: string): Promise<QuestionDTO> {
	const [q] = await db().select().from(questions).where(eq(questions.id, id)).limit(1);
	if (!q) throw new DomainError(404, 'Question not found.');
	return toQuestionDTO(q);
}

function storedHi(list: string[] | null | undefined, n: number) {
	if (!list || list.every((s) => !s.trim())) return null;
	if (list.length !== n) throw new DomainError(400, 'Hindi options must match the English options.');
	return list.map((text) => ({ text }));
}

export async function createQuestion(
	input: unknown,
	opts: { moduleId?: string | null; actorId: string | null; source?: QuestionSource }
): Promise<QuestionDTO> {
	const data = parse(questionInput, input);
	const { promptHi, optionsHi, explanationHi, ...rest } = data;
	await assertModule(opts.moduleId);
	const [q] = await db()
		.insert(questions)
		.values({
			...rest,
			options: rest.options.map((text) => ({ text })),
			promptHi: promptHi?.trim() ? promptHi : null,
			optionsHi: storedHi(optionsHi, rest.options.length),
			explanationHi: explanationHi?.trim() ? explanationHi : null,
			moduleId: opts.moduleId ?? null,
			source: opts.source ?? 'manual',
			fingerprint: fingerprint(data.prompt),
			createdById: opts.actorId
		})
		.returning();
	return toQuestionDTO(q);
}

export async function updateQuestion(id: string, input: unknown): Promise<QuestionDTO> {
	// partial() keeps defaults, so only keys the caller actually sent are applied.
	const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
	const parsed = parse(questionPatch, raw);
	const patch = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in raw)) as typeof parsed;
	const current = await getQuestion(id);
	const { options: _options, optionsHi, promptHi, explanationHi, ...rest } = patch;
	const options = patch.options ?? current.options;
	const correctIndex = patch.correctIndex ?? current.correctIndex;
	if (correctIndex >= options.length) throw new DomainError(400, 'The correct option must be one of the options.');
	const hi =
		'optionsHi' in raw
			? storedHi(optionsHi, options.length)
			: current.optionsHi && current.optionsHi.length !== options.length
				? null
				: undefined;
	const [q] = await db()
		.update(questions)
		.set({
			...rest,
			options: options.map((text) => ({ text })),
			correctIndex,
			...(hi !== undefined ? { optionsHi: hi } : {}),
			...('promptHi' in raw ? { promptHi: promptHi?.trim() ? promptHi : null } : {}),
			...('explanationHi' in raw ? { explanationHi: explanationHi?.trim() ? explanationHi : null } : {}),
			...(patch.prompt ? { fingerprint: fingerprint(patch.prompt) } : {})
		})
		.where(eq(questions.id, id))
		.returning();
	return toQuestionDTO(q);
}

/** A question used by a test cannot be deleted (attempts reference it); remove it from those tests first. */
export async function deleteQuestion(id: string) {
	const [{ n }] = await db().select({ n: count() }).from(testQuestions).where(eq(testQuestions.questionId, id));
	if (n) throw new DomainError(409, `This question is used in ${n} test${n === 1 ? '' : 's'}. Remove it there first.`);
	const [q] = await db().delete(questions).where(eq(questions.id, id)).returning({ id: questions.id });
	if (!q) throw new DomainError(404, 'Question not found.');
}

export async function moveQuestions(input: unknown): Promise<number> {
	const { ids, moduleId } = parse(moveQuestionsInput, input);
	await assertModule(moduleId);
	const moved = await db().update(questions).set({ moduleId }).where(inArray(questions.id, ids)).returning({ id: questions.id });
	return moved.length;
}

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Text (prompt contains), topic, difficulty, module ('none' = unfiled); newest first, keyset paged. */
export async function searchQuestions(input: QuestionSearch): Promise<Page<QuestionDTO>> {
	const f = parse(questionSearch, input);
	const where: (SQL | undefined)[] = [afterCursor(questions.createdAt, questions.id, f.cursor)];
	if (f.q) where.push(ilike(questions.prompt, `%${escapeLike(f.q)}%`));
	if (f.topic) where.push(ilike(questions.topic, escapeLike(f.topic)));
	if (f.difficulty) where.push(eq(questions.difficulty, f.difficulty));
	if (f.moduleId === 'none') where.push(isNull(questions.moduleId));
	else if (f.moduleId) where.push(eq(questions.moduleId, f.moduleId));
	const rows = await db()
		.select({ q: questions, cur: tsText(questions.createdAt), id: questions.id })
		.from(questions)
		.where(and(...where))
		.orderBy(desc(questions.createdAt), desc(questions.id))
		.limit(f.limit + 1);
	const page = pageOf(rows, f.limit);
	return { items: page.items.map((r) => toQuestionDTO(r.q)), nextCursor: page.nextCursor };
}

// ---------- bulk: import + AI apply ----------

const LETTERS = 'abcdef';

/** CSV header -> question object. Columns: prompt|question, a..f|option_a..|option1.., correct|answer (A-F or 1-6), explanation, topic, difficulty. */
export function csvToRows(text: string): Record<string, unknown>[] {
	const [header, ...body] = parseCsv(text);
	if (!header) return [];
	const keys = header.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
	return body.map((cells) => {
		const options: string[] = [];
		const out: Record<string, unknown> = {};
		keys.forEach((k, i) => {
			const v = (cells[i] ?? '').trim();
			const opt = /^(?:option_?|opt_?)?([a-f]|[1-6])$/.exec(k);
			if (opt) {
				const idx = /\d/.test(opt[1]) ? Number(opt[1]) - 1 : LETTERS.indexOf(opt[1]);
				if (v) options[idx] = v;
			} else if (k === 'prompt' || k === 'question') out.prompt = v;
			else if (k === 'correct_index' || k === 'correctindex') out.correctIndex = v === '' ? undefined : Number(v);
			else if (['correct', 'answer', 'correct_option', 'correct_answer', 'key'].includes(k)) {
				const letter = LETTERS.indexOf(v.toLowerCase());
				out.correctIndex = v.length === 1 && letter >= 0 ? letter : /^\d+$/.test(v) ? Number(v) - 1 : -1;
			} else if (k === 'explanation' || k === 'solution') out.explanation = v;
			else if (k === 'topic') out.topic = v;
			else if (k === 'difficulty') out.difficulty = v.toLowerCase() || undefined;
		});
		out.options = options.filter((o) => o !== undefined);
		return out;
	});
}

/**
 * Validates every row, drops duplicates (same fingerprint already in the bank or earlier in the batch) and inserts.
 * strict: any invalid row aborts the whole batch (teacher imports); otherwise bad rows are skipped (AI output).
 */
async function insertMany(
	raw: unknown[],
	opts: { moduleId: string | null; source: QuestionSource; actorId: string | null; strict: boolean; rowBase: number }
): Promise<ImportReport> {
	await assertModule(opts.moduleId);
	const report: ImportReport = { inserted: 0, ids: [], duplicates: [], errors: [] };
	const valid: { row: number; data: ReturnType<typeof questionInput.parse>; fp: string }[] = [];
	raw.forEach((item, i) => {
		const row = i + opts.rowBase;
		const r = questionInput.safeParse(item);
		if (!r.success) {
			const issue = r.error.issues[0];
			report.errors.push({ row, message: `${issue?.path.join('.') || 'row'}: ${issue?.message ?? 'invalid'}` });
		} else valid.push({ row, data: r.data, fp: fingerprint(r.data.prompt) });
	});
	if (opts.strict && report.errors.length) return report;

	const existing = new Set<string>();
	const fps = [...new Set(valid.map((v) => v.fp))];
	for (let i = 0; i < fps.length; i += 500) {
		const found = await db()
			.select({ fp: questions.fingerprint })
			.from(questions)
			.where(inArray(questions.fingerprint, fps.slice(i, i + 500)));
		for (const f of found) existing.add(f.fp);
	}
	const fresh = valid.filter((v) => {
		if (existing.has(v.fp)) {
			report.duplicates.push({ row: v.row, prompt: v.data.prompt.slice(0, 120) });
			return false;
		}
		existing.add(v.fp);
		return true;
	});
	for (let i = 0; i < fresh.length; i += 500) {
		const ids = await db()
			.insert(questions)
			.values(
				fresh.slice(i, i + 500).map((v) => {
					const { promptHi, optionsHi, explanationHi, ...rest } = v.data;
					return {
						...rest,
						options: rest.options.map((text) => ({ text })),
						promptHi: promptHi?.trim() ? promptHi : null,
						optionsHi: storedHi(optionsHi, rest.options.length),
						explanationHi: explanationHi?.trim() ? explanationHi : null,
						moduleId: opts.moduleId,
						source: opts.source,
						fingerprint: v.fp,
						createdById: opts.actorId
					};
				})
			)
			.returning({ id: questions.id });
		report.ids.push(...ids.map((r) => r.id));
	}
	report.inserted = report.ids.length;
	return report;
}

/** Bulk import. JSON: an array (or { questions: [] }); CSV: header row + one question per line. All-or-nothing on invalid rows. */
export async function importQuestions(
	input: { moduleId: string | null; format: 'json' | 'csv'; text: string },
	actorId: string | null
): Promise<ImportReport> {
	if (input.text.length > 5_000_000) throw new DomainError(400, 'File too large (5 MB max).');
	let rows: unknown[];
	if (input.format === 'csv') rows = csvToRows(input.text);
	else {
		let parsed: unknown;
		try {
			parsed = JSON.parse(input.text);
		} catch {
			throw new DomainError(400, 'That is not valid JSON.');
		}
		const list = Array.isArray(parsed) ? parsed : (parsed as { questions?: unknown })?.questions;
		if (!Array.isArray(list)) throw new DomainError(400, 'Expected a JSON array of questions.');
		rows = list;
	}
	if (!rows.length) throw new DomainError(400, 'No questions found.');
	if (rows.length > 2000) throw new DomainError(400, 'At most 2000 questions per import.');
	// CSV rows are reported by spreadsheet line (header = line 1).
	return insertMany(rows, { moduleId: input.moduleId, source: 'import', actorId, strict: true, rowBase: input.format === 'csv' ? 2 : 1 });
}

/** Applies reviewed AI output to a module. Invalid items are skipped and reported, duplicates skipped. */
export function applyGenerated(
	moduleId: string | null,
	items: unknown[],
	source: Extract<QuestionSource, 'ai_topic' | 'ai_pdf'>,
	actorId: string | null
): Promise<ImportReport> {
	return insertMany(items, { moduleId, source, actorId, strict: false, rowBase: 1 });
}
