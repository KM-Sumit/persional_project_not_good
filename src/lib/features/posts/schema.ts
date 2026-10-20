// Posts: daily current affairs, job alerts, syllabus pages, announcements. Zod inputs + DTOs. Client-safe.
import { z } from 'zod';
import { patchOf } from '#lib/zod.ts';
import { boolish, optUuid } from '../bank/schema';
import { POST_KINDS, isDate, type PostKind } from './format';

export const postKindEnum = z.enum(POST_KINDS as [PostKind, ...PostKind[]]);

export const postInput = z.object({
	kind: postKindEnum.default('current_affairs'),
	title: z.string().trim().min(1, 'Give the post a title.').max(200),
	body: z.string().max(100_000).default(''),
	examId: optUuid(),
	fileId: optUuid(),
	publishedOn: z.string().refine(isDate, 'Pick a date.'),
	published: boolish().default(false)
});
export type PostInput = z.input<typeof postInput>;
export const postPatch = patchOf(postInput);

export type PostDTO = {
	id: string;
	kind: PostKind;
	slug: string;
	title: string;
	body: string;
	examId: string | null;
	fileId: string | null;
	quizTestId: string | null;
	publishedOn: string;
	published: boolean;
	createdAt: string;
};
/** A list row: no body, a short plain-text excerpt instead. */
export type PostCard = Omit<PostDTO, 'body'> & { excerpt: string; examName: string | null };
/** A published post for reading: server-rendered safe HTML. */
export type PostPage = PostCard & { html: string; readingMinutes: number };
