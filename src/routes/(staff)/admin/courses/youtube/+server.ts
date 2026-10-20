import { error, json } from '@sveltejs/kit';
import { requireStaff } from '#lib/server/http';
import { ytInfo } from '../youtube.server';
import type { RequestHandler } from './$types';

/** GET ?url=<any YouTube link> -> { id, title, thumb }. Staff only (layouts don't guard endpoints). */
export const GET: RequestHandler = async (event) => {
	requireStaff(event);
	const info = await ytInfo(event.url.searchParams.get('url') ?? '');
	if (!info) error(422, 'That is not a YouTube link.');
	return json(info, { headers: { 'cache-control': 'private, max-age=3600' } });
};
