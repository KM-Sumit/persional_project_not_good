import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { createJob, listJobs } from '#lib/features/ai/server/service';
import { aiEnabled } from '#lib/server/ai/generate';
import { tree } from '#lib/features/taxonomy/server/service';
import { act, formObject } from '#lib/features/bank/components/act.server';
import { requireStaff } from '#lib/server/http';
import type { GenerateInputRaw } from '#lib/features/ai/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireStaff(event);
	const [jobs, taxonomy] = await Promise.all([listJobs(user.id, 8), tree()]);
	return { jobs, taxonomy, enabled: aiEnabled() };
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireStaff(event);
		const o = formObject(await event.request.formData());
		const common = {
			count: o.count,
			difficulty: o.difficulty,
			language: o.language,
			subject: o.subject ?? '',
			examName: o.examName ?? '',
			instructions: o.instructions ?? ''
		};
		const input = (
			o.mode === 'pdf'
				? { mode: 'pdf', fileId: o.fileId || undefined, pageFrom: o.pageFrom || undefined, pageTo: o.pageTo || undefined, ...common }
				: { mode: 'topic', topic: o.topic ?? '', ...common }
		) as GenerateInputRaw;
		const job = await act(() => createJob(input, user.id));
		if (!('id' in job)) return job;
		const exam = typeof o.examId === 'string' && z.uuid().safeParse(o.examId).success ? o.examId : '';
		const q = new URLSearchParams();
		if (o.then === 'test') q.set('then', 'test');
		if (exam) q.set('exam', exam);
		const qs = q.toString();
		redirect(303, `/admin/bank/generate/${job.id}${qs ? `?${qs}` : ''}`);
	}
};
