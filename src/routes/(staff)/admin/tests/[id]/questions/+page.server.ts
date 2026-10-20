import { fail } from '@sveltejs/kit';
import {
	addQuestions,
	buildFromModules,
	createInlineQuestion,
	listTestQuestions,
	removeQuestion,
	reorderQuestions,
	setQuestionMarks
} from '#lib/features/tests/server/service';
import { listModules, updateQuestion } from '#lib/features/bank/server/service';
import { act, formObject, idsFrom, questionFromForm } from '#lib/features/bank/components/act.server';
import { requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const [questions, modules] = await Promise.all([listTestQuestions(event.params.id), listModules()]);
	return { questions, modules };
};

export const actions: Actions = {
	remove: async (event) => {
		requireStaff(event);
		const qid = String((await event.request.formData()).get('questionId') ?? '');
		return act(async () => (await removeQuestion(event.params.id, qid), { message: 'Question removed' }));
	},
	marks: async (event) => {
		requireStaff(event);
		const o = formObject(await event.request.formData());
		return act(async () => (await setQuestionMarks(event.params.id, o.questionId, o), { message: 'Marks saved' }));
	},
	reorder: async (event) => {
		requireStaff(event);
		const ids = idsFrom(await event.request.formData());
		return act(async () => (await reorderQuestions(event.params.id, ids), { message: 'Order saved' }));
	},
	add: async (event) => {
		requireStaff(event);
		const ids = idsFrom(await event.request.formData());
		if (!ids.length) return fail(400, { message: 'Pick some questions.' });
		return act(async () => ({ message: `${await addQuestions(event.params.id, ids)} questions added` }));
	},
	build: async (event) => {
		requireStaff(event);
		const o = formObject(await event.request.formData());
		return act(async () => {
			const r = await buildFromModules(event.params.id, [{ moduleId: o.moduleId, count: o.count, difficulty: o.difficulty || undefined }]);
			const short = r.shortfalls[0];
			return { message: short ? `${r.added} added; the module had only ${short.added} matching.` : `${r.added} questions added` };
		});
	},
	write: async (event) => {
		const user = requireStaff(event);
		const fd = await event.request.formData();
		const o = formObject(fd);
		const question = questionFromForm(fd);
		return act(async () => {
			if (o.id) await updateQuestion(o.id, question);
			else await createInlineQuestion(event.params.id, { question, moduleId: o.moduleId || null }, user.id);
			return { message: o.id ? 'Question updated' : 'Question added' };
		});
	}
};
