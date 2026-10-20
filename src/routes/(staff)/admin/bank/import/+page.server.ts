import { fail } from '@sveltejs/kit';
import { createModule, csvToRows, importQuestions, listModules } from '#lib/features/bank/server/service';
import { fingerprint } from '#lib/features/bank/server/fingerprint';
import { questionInput } from '#lib/features/bank/schema';
import { act } from '#lib/features/bank/components/act.server';
import { requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	return { modules: await listModules(), moduleId: event.url.searchParams.get('module') ?? '' };
};

const detect = (text: string) => (/^\s*[[{]/.test(text) ? 'json' : 'csv');

function rowsOf(text: string): { format: 'json' | 'csv'; rows: unknown[] } | string {
	const format = detect(text);
	if (format === 'csv') return { format, rows: csvToRows(text) };
	try {
		const parsed = JSON.parse(text);
		const list = Array.isArray(parsed) ? parsed : parsed?.questions;
		return Array.isArray(list) ? { format, rows: list } : 'Expected a JSON array of questions.';
	} catch {
		return 'That is not valid JSON.';
	}
}

export const actions: Actions = {
	/** Validates every row and flags repeats inside the sheet; nothing is written. */
	preview: async (event) => {
		requireStaff(event);
		const text = String((await event.request.formData()).get('text') ?? '');
		if (!text.trim()) return fail(400, { message: 'Paste questions or choose a file.' });
		if (text.length > 5_000_000) return fail(400, { message: 'File too large (5 MB max).' });
		const parsed = rowsOf(text);
		if (typeof parsed === 'string') return fail(400, { message: parsed });
		const base = parsed.format === 'csv' ? 2 : 1;
		const seen = new Set<string>();
		const rows = parsed.rows.map((raw, i) => {
			const r = questionInput.safeParse(raw);
			if (!r.success) {
				const issue = r.error.issues[0];
				const prompt = String((raw as { prompt?: unknown })?.prompt ?? '');
				return { row: i + base, prompt, options: [] as string[], correctIndex: -1, error: `${issue?.path.join('.') || 'row'}: ${issue?.message}`, dup: false };
			}
			const fp = fingerprint(r.data.prompt);
			const dup = seen.has(fp);
			seen.add(fp);
			return { row: i + base, prompt: r.data.prompt, options: r.data.options, correctIndex: r.data.correctIndex, error: null, dup };
		});
		return {
			preview: {
				format: parsed.format,
				total: rows.length,
				errors: rows.filter((r) => r.error).length,
				dups: rows.filter((r) => r.dup).length,
				rows: rows.slice(0, 300)
			}
		};
	},
	import: async (event) => {
		const user = requireStaff(event);
		const fd = await event.request.formData();
		const text = String(fd.get('text') ?? '');
		const newName = String(fd.get('newModule') ?? '').trim();
		return act(async () => {
			const moduleId = newName ? (await createModule({ name: newName }, user.id)).id : String(fd.get('moduleId') || '') || null;
			const report = await importQuestions({ moduleId, format: detect(text), text }, user.id);
			if (report.errors.length) return fail(422, { message: `Row ${report.errors[0].row}: ${report.errors[0].message}` });
			return { report: { inserted: report.inserted, duplicates: report.duplicates.length }, moduleId };
		});
	}
};
