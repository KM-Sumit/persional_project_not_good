import { fail } from '@sveltejs/kit';
import { requireStaff } from '#lib/server/http';
import * as site from '#lib/features/site/server/service';
import { SETTING_KEYS } from '#lib/features/site/schema';
import { act, ids, on, str } from '../students/_act.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const [settings, toppers, faculty] = await Promise.all([site.getSettings(), site.listToppers(), site.listFaculty()]);
	return { settings, toppers, faculty };
};

const SOCIALS = ['youtube', 'instagram', 'facebook', 'whatsapp', 'telegram', 'x'] as const;

/** Builds the patch for the keys a section card sent; "" clears a key. */
function settingsPatch(d: FormData) {
	const patch: Record<string, unknown> = {};
	for (const k of SETTING_KEYS) {
		if (k === 'socials') {
			if (!d.has('socials.youtube')) continue;
			const s: Record<string, string | undefined> = {};
			for (const n of SOCIALS) s[n] = str(d, `socials.${n}`) || undefined;
			patch.socials = Object.values(s).some(Boolean) ? s : undefined;
		} else if (k === 'stats') {
			if (!d.has('stats.label')) continue;
			const labels = d.getAll('stats.label').map(String);
			const values = d.getAll('stats.value').map(String);
			const stats = labels.map((label, i) => ({ label: label.trim(), value: (values[i] ?? '').trim() })).filter((s) => s.label && s.value);
			patch.stats = stats.length ? stats : undefined;
		} else if (d.has(k)) patch[k] = str(d, k);
	}
	return patch;
}

const kindOf = (d: FormData) => (str(d, 'kind') === 'faculty' ? 'faculty' : 'topper');

export const actions: Actions = {
	settings: async (event) => {
		const me = requireStaff(event);
		const patch = settingsPatch(await event.request.formData());
		return act(() => site.setSettings(patch, me.id), 'Saved');
	},
	savePerson: async (event) => {
		const me = requireStaff(event);
		const d = await event.request.formData();
		const id = str(d, 'id');
		const photoFileId = str(d, 'photoFileId') || null;
		const published = on(d, 'published');
		if (kindOf(d) === 'faculty') {
			const input = { name: str(d, 'name'), subject: str(d, 'subject'), bio: str(d, 'bio'), photoFileId, published };
			return act(() => (id ? site.updateFaculty(id, input, me.id) : site.createFaculty(input, me.id)), id ? 'Faculty saved' : 'Faculty added');
		}
		const input = { name: str(d, 'name'), exam: str(d, 'exam'), result: str(d, 'result'), quote: str(d, 'quote'), photoFileId, published };
		return act(() => (id ? site.updateTopper(id, input, me.id) : site.createTopper(input, me.id)), id ? 'Topper saved' : 'Topper added');
	},
	publish: async (event) => {
		const me = requireStaff(event);
		const d = await event.request.formData();
		const p = on(d, 'published');
		const id = str(d, 'id');
		const msg = p ? 'Published' : 'Hidden from the website';
		return act(() => (kindOf(d) === 'faculty' ? site.setFacultyPublished(id, p, me.id) : site.setTopperPublished(id, p, me.id)), msg);
	},
	reorder: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const list = ids(d);
		if (!list.length) return fail(400, { message: 'Nothing to reorder.' });
		return act(() => (kindOf(d) === 'faculty' ? site.reorderFaculty(list) : site.reorderToppers(list)), 'Order saved');
	},
	deletePerson: async (event) => {
		const me = requireStaff(event);
		const d = await event.request.formData();
		const id = str(d, 'id');
		return act(() => (kindOf(d) === 'faculty' ? site.deleteFaculty(id, me.id) : site.deleteTopper(id, me.id)), 'Deleted');
	}
};
