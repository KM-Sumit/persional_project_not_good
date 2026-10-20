import { publishedBySlug } from '#lib/features/posts/server/service';
import { toHttp } from '#lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => ({ post: await publishedBySlug('current_affairs', params.slug).catch(toHttp) });
