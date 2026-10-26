import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { addQuestions, buildFromModules, createInlineQuestion, createTest, createTestSet, ensureSetProduct, getTestSet, publishTest, renameTestSet, saveSetGate } from '#lib/features/tests/server/service';
import { importQuestions, listModules } from '#lib/features/bank/server/service';
import { listBatches, listSessions } from '#lib/features/cohorts/server/service';
import { tree } from '#lib/features/taxonomy/server/service';
import { act } from '#lib/features/bank/components/act.server';
import { requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const [taxonomy, sessions, batches, modules] = await Promise.all([tree(), listSessions(), listBatches(), listModules()]);
	const setId = event.url.searchParams.get('set');
	const existingSet = setId ? await getTestSet(setId).catch(() => null) : null;
	return {
		taxonomy,
		sessions,
		batches,
		modules,
		existingSet: existingSet ? { id: existingSet.id, name: existingSet.name, examId: existingSet.examId } : null
	};
};

// The wizard posts one JSON document; the services validate every part of it.
const one = z.object({
	fields: z.record(z.string(), z.unknown()),
	blueprint: z.array(z.unknown()).default([]),
	questionIds: z.array(z.string()).max(500).default([]),
	newQuestions: z.array(z.unknown()).max(200).default([]),
	importText: z.string().max(5_000_000).default('')
});
const plan = z.object({
	mode: z.enum(['single', 'set']).default('single'),
	setName: z.string().trim().max(120).default(''),
	setId: z.string().uuid().nullable().default(null),
	setAccess: z.enum(['open', 'password', 'paid']).default('open'),
	setPrice: z.number().int().min(1).max(1_000_000).nullable().default(null),
	setPassword: z.string().max(64).nullable().default(null),
	publish: z.boolean().default(false),
	tests: z.array(one).min(1).max(40)
});

export const actions: Actions = {
	create: async (event) => {
		const user = requireStaff(event);
		let p: z.infer<typeof plan>;
		try {
			p = plan.parse(JSON.parse(String((await event.request.formData()).get('plan') ?? '')));
		} catch {
			return fail(400, { message: 'The form did not arrive whole. Try again.' });
		}
		let setId = p.mode === 'set' ? p.setId : null;
		if (p.mode === 'set' && !setId) {
			const rawExam = p.tests[0]?.fields.examId;
			const made = await act(() => createTestSet(p.setName, typeof rawExam === 'string' && rawExam ? rawExam : null));
			if (!('id' in made)) return made;
			setId = made.id;
		} else if (p.mode === 'set' && setId && p.setName) {
			const renamed = await act(() => renameTestSet(setId!, p.setName));
			if (renamed && typeof renamed === 'object' && 'status' in renamed) return renamed;
		}
		const warnings: string[] = [];
		const passwords: { title: string; password: string }[] = [];
		if (p.mode === 'set' && setId) {
			const gated = await act(() => saveSetGate(setId!, { access: p.setAccess, priceInr: p.setPrice, password: p.setPassword }));
			if (gated && typeof gated === 'object' && 'status' in gated) return gated;
			if (typeof gated === 'string') passwords.push({ title: p.setName || 'Set', password: gated });
		}
		let firstId = '';
		let published = false;
		for (const [index, item] of p.tests.entries()) {
			const label = String(item.fields.title ?? `Test ${index + 1}`);
			const fields =
				p.mode === 'set' ? { ...item.fields, setId, access: 'open', priceInr: null, password: null } : { ...item.fields, setId: null };
			const saved = await act(() => createTest(fields, user.id));
			if (!('test' in saved)) return saved;
			const id = saved.test.id;
			if (!firstId) firstId = id;
			if (saved.password) passwords.push({ title: label, password: saved.password });
			const step = async (what: string, fn: () => Promise<unknown>) => {
				try {
					await fn();
				} catch (e) {
					warnings.push(`${label} — ${what}: ${(e as Error).message}`);
				}
			};
			if (item.blueprint.length)
				await step('From modules', async () => {
					const r = await buildFromModules(id, item.blueprint);
					for (const s of r.shortfalls) warnings.push(`${label}: a module had only ${s.added} of the ${s.requested} questions asked for.`);
				});
			if (item.questionIds.length) await step('Picked questions', () => addQuestions(id, item.questionIds));
			for (const q of item.newQuestions) await step('New question', () => createInlineQuestion(id, { question: q }, user.id));
			if (item.importText.trim())
				await step('Import', async () => {
					const format = /^\s*[[{]/.test(item.importText) ? 'json' : 'csv';
					const r = await importQuestions({ moduleId: null, format, text: item.importText }, user.id);
					if (r.errors.length) throw new Error(`row ${r.errors[0].row}: ${r.errors[0].message}`);
					if (r.duplicates.length) warnings.push(`${label}: ${r.duplicates.length} imported questions were already in the bank and were skipped.`);
					await addQuestions(id, r.ids);
				});
			if (p.publish) await step('Publish', async () => ((await publishTest(id)), (published = true)));
		}
		if (p.mode === 'set' && setId && p.publish && p.setAccess === 'paid' && p.setPrice && firstId) {
			const product = await act(() => ensureSetProduct(setId!, p.setName || 'Test set', p.setPrice!, firstId, true));
			if (product && typeof product === 'object' && 'status' in product) return product;
		}
		return { id: firstId, setId, password: passwords[0]?.password ?? null, passwords, published, warnings };
	}
};
