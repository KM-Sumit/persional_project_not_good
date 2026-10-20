import { syllabusExams } from '#lib/features/posts/server/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ exams: await syllabusExams() });
