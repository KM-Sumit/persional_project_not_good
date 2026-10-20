import { error, fail, redirect } from '@sveltejs/kit';
import { getJob, markApplied } from '#lib/features/ai/server/service';
import { applyGenerated, createModule, listModules } from '#lib/features/bank/server/service';
import { addQuestions, createTest } from '#lib/features/tests/server/service';
import { currentSession } from '#lib/features/cohorts/server/service';
import { act } from '#lib/features/bank/components/act.server';
import { DomainError, requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	try {
		const [job, modules] = await Promise.all([getJob(event.params.jobId), listModules()]);
		return { job, modules };
	} catch (e) {
		if (e instanceof DomainError) error(e.status, e.message);
		throw e;
	}
};

export const actions: Actions = {
	/** Copies the accepted (possibly edited) questions into a module; optionally makes a draft test of them. */
	apply: async (event) => {
		const user = requireStaff(event);
		const fd = await event.request.formData();
		let items: unknown[];
		try {
			items = JSON.parse(String(fd.get('questions') ?? '[]'));
		} catch {
			return fail(400, { message: 'Bad question list.' });
		}
		if (!Array.isArray(items) || !items.length) return fail(400, { message: 'Accept at least one question.' });
		const newName = String(fd.get('newModule') ?? '').trim();
		const r = await act(async () => {
			const job = await getJob(event.params.jobId);
			if (job.status !== 'ready') throw new DomainError(409, job.status === 'applied' ? 'This run was already added to the bank.' : 'This run is not finished.');
			const moduleId = newName ? (await createModule({ name: newName }, user.id)).id : String(fd.get('moduleId') || '') || null;
			const report = await applyGenerated(moduleId, items, job.source, user.id);
			await markApplied(job.id);
			let testId: string | null = null;
			if (fd.get('createTest') === 'on' && report.ids.length) {
				const session = await currentSession();
				const title = String(fd.get('testTitle') || job.input.topic || 'AI practice test').slice(0, 200);
				testId = (await createTest({ title, sessionId: session?.id }, user.id)).test.id;
				await addQuestions(testId, report.ids);
			}
			return { moduleId, testId, inserted: report.inserted };
		});
		if (!('inserted' in r)) return r;
		redirect(303, r.testId ? `/admin/tests/${r.testId}` : r.moduleId ? `/admin/bank/${r.moduleId}` : '/admin/bank');
	}
};
