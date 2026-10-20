import { error, redirect } from '@sveltejs/kit';
import { listNotes, noteDetail } from '$lib/features/catalog/server/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const note = await noteDetail(params.id);
	if (!note) error(404, 'Note not found');
	const shelf = await listNotes();
	const index = shelf.findIndex((item) => item.id === note.id);
	const neighbor = (item: (typeof shelf)[number] | undefined) =>
		item ? { id: item.id, title: item.title } : null;
	return {
		...note,
		index: Math.max(index, 0),
		total: shelf.length,
		previous: neighbor(index > 0 ? shelf[index - 1] : undefined),
		next: neighbor(index >= 0 ? shelf[index + 1] : undefined)
	};
};
