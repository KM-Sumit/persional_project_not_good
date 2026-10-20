import { redirect } from '@sveltejs/kit';
import { requireStaff, toHttp } from '#lib/server/http';
import {
	backToScheduled,
	cancelLive,
	deleteLive,
	endLive,
	getLiveAdmin,
	goLive,
	staffOptions,
	updateLive
} from '#lib/features/live/server/service';
import { act, on, str } from '../../students/_act.server';
import { liveFields } from '../_fields.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireStaff(event);
	const [live, options] = await Promise.all([getLiveAdmin(event.params.id).catch(toHttp), staffOptions()]);
	return { live, options, serverNow: new Date().toISOString() };
};

export const actions: Actions = {
	update: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => updateLive(event.params.id, liveFields(d)), 'Class saved');
	},
	goLive: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		return act(() => goLive(event.params.id, { stream: str(d, 'stream') }), 'You are live. Students can join now.');
	},
	unlive: async (event) => {
		requireStaff(event);
		return act(() => backToScheduled(event.params.id), 'Moved back to scheduled');
	},
	end: async (event) => {
		requireStaff(event);
		const d = await event.request.formData();
		const save = on(d, 'saveAsLesson');
		return act(
			() => endLive(event.params.id, { saveAsLesson: save, chapterId: str(d, 'chapterId'), lessonTitle: str(d, 'lessonTitle') }),
			save ? 'Class ended. Recording saved as a lesson.' : 'Class ended'
		);
	},
	cancel: async (event) => {
		requireStaff(event);
		return act(() => cancelLive(event.params.id), 'Class cancelled');
	},
	delete: async (event) => {
		requireStaff(event);
		const r = await act(() => deleteLive(event.params.id), 'Class deleted');
		if (!('status' in r)) redirect(303, '/admin/live');
		return r;
	}
};
