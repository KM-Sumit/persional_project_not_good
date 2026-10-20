// Form fields -> live class input. Shared by create (list page) and edit ([id]).
import { on, str } from '../students/_act.server';

export const liveFields = (d: FormData) => ({
	title: str(d, 'title'),
	description: str(d, 'description'),
	teacher: str(d, 'teacher') || undefined,
	examId: str(d, 'examId'),
	batchId: str(d, 'batchId'),
	courseId: str(d, 'courseId'),
	startsAt: str(d, 'startsAt'),
	durationMin: str(d, 'durationMin') || undefined,
	isPaid: on(d, 'isPaid')
});
