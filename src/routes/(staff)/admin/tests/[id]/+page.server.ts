import { redirect } from '@sveltejs/kit';
import {
	archiveTest,
	cancelTest,
	deleteTest,
	duplicateTest,
	publishTest,
	unpublishTest,
	updateTest
} from '#lib/features/tests/server/service';
import { listBatches, listSessions } from '#lib/features/cohorts/server/service';
import { tree } from '#lib/features/taxonomy/server/service';
import { act, formObject } from '#lib/features/bank/components/act.server';
import { requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const [taxonomy, sessions, batches] = await Promise.all([tree(), listSessions(), listBatches()]);
	return { taxonomy, sessions, batches };
};

const lifecycle = (fn: (id: string) => Promise<unknown>, message: string) => async (event: Parameters<Actions[string]>[0]) => {
	requireStaff(event);
	return act(async () => (await fn(event.params.id!), { message }));
};

export const actions: Actions = {
	update: async (event) => {
		requireStaff(event);
		const o = formObject(await event.request.formData());
		return act(async () => {
			const r = await updateTest(event.params.id, o);
			return { message: 'Changes saved', password: r.password };
		});
	},
	publish: lifecycle(publishTest, 'Test published'),
	unpublish: lifecycle(unpublishTest, 'Moved to drafts'),
	cancel: lifecycle(cancelTest, 'Test cancelled'),
	archive: lifecycle(archiveTest, 'Test archived'),
	duplicate: async (event) => {
		const user = requireStaff(event);
		const r = await act(() => duplicateTest(event.params.id, user.id));
		if (!('id' in r)) return r;
		redirect(303, `/admin/tests/${r.id}`);
	},
	delete: async (event) => {
		requireStaff(event);
		const r = await act(() => deleteTest(event.params.id));
		if (r) return r;
		redirect(303, '/admin/tests');
	}
};
