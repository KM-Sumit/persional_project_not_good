import { fail } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/http';
import { listPeople, setRole } from '#lib/features/people/server/service';
import { roles, type Role } from '#lib/features/people/schema';
import { act, str } from '../students/_act.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const me = requireAdmin(event);
	const [admins, teachers] = await Promise.all([
		listPeople({ role: 'admin', sort: 'name', limit: 200 }),
		listPeople({ role: 'teacher', sort: 'name', limit: 200 })
	]);
	return { me: me.id, staff: [...admins.items, ...teachers.items] };
};

const asRole = (v: string): Role | null => ((roles as readonly string[]).includes(v) ? (v as Role) : null);

export const actions: Actions = {
	role: async (event) => {
		const me = requireAdmin(event);
		const d = await event.request.formData();
		const role = asRole(str(d, 'role'));
		if (!role) return fail(400, { message: 'Pick a role.' });
		return act(() => setRole(me, str(d, 'id'), role), role === 'student' ? 'Removed from the team' : `Role changed to ${role}`);
	},
	add: async (event) => {
		const me = requireAdmin(event);
		const d = await event.request.formData();
		const email = str(d, 'email').toLowerCase();
		const role = asRole(str(d, 'role'));
		if (!email.includes('@') || !role || role === 'student') return fail(400, { message: 'Enter an email and pick a role.' });
		// The people service has no pending invites, so only existing accounts can be promoted.
		const found = (await listPeople({ q: email, limit: 5 })).items.find((p) => p.email.toLowerCase() === email);
		if (!found) return fail(404, { message: `${email} has not signed in yet. Ask them to sign in once with Google, then add them.` });
		return act(() => setRole(me, found.id, role), `${found.name} is now a ${role}`);
	}
};
