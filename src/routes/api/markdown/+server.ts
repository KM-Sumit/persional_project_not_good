import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { renderMarkdown } from '#lib/features/notes/server/markdown';
import { body, requireStaff } from '#lib/server/http';
import type { RequestHandler } from './$types';

const Input = z.object({ md: z.string().max(200_000, 'The text is too long to preview.') });

/** Editor preview: the same safe renderer notes use (raw HTML escaped, KaTeX math). Staff only. */
export const POST: RequestHandler = async (event) => {
	requireStaff(event);
	const { md } = await body(event, Input);
	return json({ html: renderMarkdown(md) });
};
