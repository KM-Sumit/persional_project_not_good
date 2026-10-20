import { fail, redirect } from '@sveltejs/kit';
import {
	createQuestion,
	deleteModule,
	deleteQuestion,
	getModule,
	listModules,
	moveQuestions,
	searchQuestions,
	updateModule,
	updateQuestion
} from '#lib/features/bank/server/service';
import { addQuestions, createTest } from '#lib/features/tests/server/service';
import { currentSession } from '#lib/features/cohorts/server/service';
import { act, formObject, idsFrom, questionFromForm } from '#lib/features/bank/components/act.server';
import { DomainError, requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const sp = event.url.searchParams;
	const id = event.params.moduleId;
	const filter = {
		q: sp.get('q')?.trim() || undefined,
		topic: sp.get('topic')?.trim() || undefined,
		difficulty: (sp.get('difficulty') || undefined) as 'easy' | 'medium' | 'hard' | undefined,
		cursor: sp.get('cursor')
	};
	try {
		const [module, page, modules] = await Promise.all([
			getModule(id),
			searchQuestions({ ...filter, moduleId: id, limit: 30 }),
			listModules()
		]);
		return { module, page, modules: modules.filter((m) => m.id !== id), filter };
	} catch (e) {
		if (e instanceof DomainError && e.status === 404) redirect(303, '/admin/bank');
		throw e;
	}
};

export const actions: Actions = {
	save: async (event) => {
		const user = requireStaff(event);
		const fd = await event.request.formData();
		const id = String(fd.get('id') ?? '');
		const q = questionFromForm(fd);
		return act(async () => {
			const saved = id ? await updateQuestion(id, q) : await createQuestion(q, { moduleId: event.params.moduleId, actorId: user.id });
			return { saved: saved.id };
		});
	},
	delete: async (event) => {
		requireStaff(event);
		const ids = idsFrom(await event.request.formData());
		const errors: string[] = [];
		for (const id of ids) await deleteQuestion(id).catch((e: Error) => errors.push(e.message));
		if (errors.length) return fail(409, { message: `${ids.length - errors.length} deleted. ${errors[0]}` });
		return { deleted: ids.length };
	},
	move: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return act(async () => ({ moved: await moveQuestions({ ids: idsFrom(fd), moduleId: String(fd.get('moduleId') || '') || null }) }));
	},
	rename: async (event) => {
		requireStaff(event);
		const fd = await event.request.formData();
		return act(async () => ({ module: await updateModule(event.params.moduleId, formObject(fd)) }));
	},
	deleteModule: async (event) => {
		requireStaff(event);
		const r = await act(() => deleteModule(event.params.moduleId));
		if (r) return r;
		redirect(303, '/admin/bank');
	},
	/** "Create test from selected": a draft practice test with these questions, opened in the test editor. */
	createTest: async (event) => {
		const user = requireStaff(event);
		const fd = await event.request.formData();
		const ids = idsFrom(fd);
		if (!ids.length) return fail(400, { message: 'Select some questions first.' });
		const r = await act(async () => {
			const m = await getModule(event.params.moduleId);
			const session = await currentSession();
			const { test } = await createTest({ title: String(fd.get('title') || m.name), examId: m.examId, subjectId: m.subjectId, sessionId: session?.id }, user.id);
			await addQuestions(test.id, ids);
			return test.id;
		});
		if (typeof r !== 'string') return r;
		redirect(303, `/admin/tests/${r}/questions`);
	}
};
