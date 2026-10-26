import { requireStaff } from '#lib/server/http';
import * as tx from '#lib/features/taxonomy/server/service';
import { act, ids, on, str } from '../students/_act.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	return { tree: await tx.tree() };
};

export const actions: Actions = {
	saveCategory: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const id = str(d, 'id');
		const input = { name: str(d, 'name'), description: str(d, 'description'), logoFileId: str(d, 'logoFileId') || null };
		return act(() => (id ? tx.updateCategory(id, input) : tx.createCategory(input)), id ? 'Category saved' : 'Category added');
	},
	saveExam: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const id = str(d, 'id');
		const input = { name: str(d, 'name'), description: str(d, 'description'), categoryId: str(d, 'categoryId') };
		return act(() => (id ? tx.updateExam(id, input) : tx.createExam(input)), id ? 'Exam saved' : 'Exam added');
	},
	enable: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const en = on(d, 'enabled');
		const id = str(d, 'id');
		return act(() => (str(d, 'type') === 'exam' ? tx.setExamEnabled(id, en) : tx.setCategoryEnabled(id, en)), en ? 'Shown' : 'Hidden');
	},
	reorder: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const list = ids(d);
		const type = str(d, 'type');
		return act(
			() => (type === 'exam' ? tx.reorderExams(str(d, 'categoryId'), list) : type === 'subject' ? tx.reorderSubjects(list) : tx.reorderCategories(list)),
			'Order saved'
		);
	},
	delete: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const id = str(d, 'id');
		const type = str(d, 'type');
		return act(() => (type === 'exam' ? tx.deleteExam(id) : type === 'subject' ? tx.deleteSubject(id) : tx.deleteCategory(id)), 'Deleted');
	},
	saveSubject: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const id = str(d, 'id');
		const input = { name: str(d, 'name') };
		return act(() => (id ? tx.updateSubject(id, input) : tx.createSubject(input)), id ? 'Subject saved' : 'Subject added');
	}
};
