import { getTestSet, renameTestSet } from '#lib/features/tests/server/service';
import { act } from '#lib/features/bank/components/act.server';
import { requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	return { set: await getTestSet(event.params.id) };
};

export const actions: Actions = {
	rename: async (event) => {
		requireStaff(event);
		const name = String((await event.request.formData()).get('name') ?? '');
		const saved = await act(() => renameTestSet(event.params.id, name));
		if (saved && typeof saved === 'object' && 'status' in saved) return saved;
		return { message: 'Set name saved' };
	}
};
