import { syllabusFor } from '#lib/features/posts/server/service';
import { toHttp } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => ({ post: await syllabusFor(params.exam).catch(toHttp) });
