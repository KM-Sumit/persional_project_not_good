import { redirect } from '@sveltejs/kit';
import { createModule, listModules } from '#lib/features/bank/server/service';
import { tree } from '#lib/features/taxonomy/server/service';
import { act, formObject } from '#lib/features/bank/components/act.server';
import { requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const q = event.url.searchParams.get('q')?.trim() || undefined;
	const exam = event.url.searchParams.get('exam') || undefined;
	const [modules, taxonomy] = await Promise.all([listModules({ q, examId: exam }), tree()]);
	return { modules, taxonomy, q: q ?? '' };
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireStaff(event);
		const fd = await event.request.formData();
		const m = await act(() => createModule(formObject(fd), user.id));
		if ('id' in m) redirect(303, `/admin/bank/${m.id}`);
		return m;
	}
};
