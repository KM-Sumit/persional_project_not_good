import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { addQuestions, buildFromModules, createInlineQuestion, createTest, publishTest } from '#lib/features/tests/server/service';
import { importQuestions, listModules } from '#lib/features/bank/server/service';
import { listBatches, listSessions } from '#lib/features/cohorts/server/service';
import { tree } from '#lib/features/taxonomy/server/service';
import { act } from '#lib/features/bank/components/act.server';
import { requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const [taxonomy, sessions, batches, modules] = await Promise.all([tree(), listSessions(), listBatches(), listModules()]);
	return { taxonomy, sessions, batches, modules };
};

// The wizard posts one JSON document; the services validate every part of it.
const plan = z.object({
	fields: z.record(z.string(), z.unknown()),
	blueprint: z.array(z.unknown()).default([]),
	questionIds: z.array(z.string()).max(500).default([]),
	newQuestions: z.array(z.unknown()).max(200).default([]),
	importText: z.string().max(5_000_000).default(''),
	publish: z.boolean().default(false)
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
		const saved = await act(() => createTest(p.fields, user.id));
		if (!('test' in saved)) return saved;
		const id = saved.test.id;
		// The test exists from here on; later failures leave it as a draft and say why.
		const warnings: string[] = [];
		const step = async (what: string, fn: () => Promise<unknown>) => {
			try {
				await fn();
			} catch (e) {
				warnings.push(`${what}: ${(e as Error).message}`);
			}
		};
		if (p.blueprint.length)
			await step('From modules', async () => {
				const r = await buildFromModules(id, p.blueprint);
				for (const s of r.shortfalls) warnings.push(`A module had only ${s.added} of the ${s.requested} questions asked for.`);
			});
		if (p.questionIds.length) await step('Picked questions', () => addQuestions(id, p.questionIds));
		for (const q of p.newQuestions) await step('New question', () => createInlineQuestion(id, { question: q }, user.id));
		if (p.importText.trim())
			await step('Import', async () => {
				const format = /^\s*[[{]/.test(p.importText) ? 'json' : 'csv';
				const r = await importQuestions({ moduleId: null, format, text: p.importText }, user.id);
				if (r.errors.length) throw new Error(`row ${r.errors[0].row}: ${r.errors[0].message}`);
				if (r.duplicates.length) warnings.push(`${r.duplicates.length} imported questions were already in the bank and were skipped.`);
				await addQuestions(id, r.ids);
			});
		let published = false;
		if (p.publish) await step('Publish', async () => ((await publishTest(id)), (published = true)));
		return { id, password: saved.password, published, warnings };
	}
};
