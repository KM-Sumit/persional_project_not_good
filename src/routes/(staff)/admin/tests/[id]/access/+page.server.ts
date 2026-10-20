import { addGrant, listGrants, removeGrant, setPassword, updateTest } from '#lib/features/tests/server/service';
import { listPeople } from '#lib/features/people/server/service';
import { act, formObject } from '#lib/features/bank/components/act.server';
import { requireStaff } from '#lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const q = event.url.searchParams.get('q')?.trim() ?? '';
	const [grants, found] = await Promise.all([
		listGrants(event.params.id),
		q.length >= 2 ? listPeople({ q, role: 'student', limit: 8 }).then((r) => r.items) : Promise.resolve([])
	]);
	return { grants, found, q };
};

export const actions: Actions = {
	/** Sets a custom password, or generates one when left empty. The plaintext comes back once. */
	password: async (event) => {
		requireStaff(event);
		const custom = String((await event.request.formData()).get('password') ?? '').trim() || null;
		return act(async () => ({ password: await setPassword(event.params.id, custom) }));
	},
	access: async (event) => {
		requireStaff(event);
		const o = formObject(await event.request.formData());
		return act(async () => {
			const r = await updateTest(event.params.id, { access: o.access, ...(o.access === 'paid' ? { priceInr: o.priceInr } : {}) });
			return { password: r.password, message: 'Access updated' };
		});
	},
	grant: async (event) => {
		const user = requireStaff(event);
		const o = formObject(await event.request.formData());
		return act(async () => {
			const g = await addGrant(event.params.id, o, user.id);
			return { message: `${g.name} can now take this test` };
		});
	},
	revoke: async (event) => {
		requireStaff(event);
		const userId = String((await event.request.formData()).get('userId') ?? '');
		return act(async () => (await removeGrant(event.params.id, userId), { message: 'Access removed' }));
	}
};
