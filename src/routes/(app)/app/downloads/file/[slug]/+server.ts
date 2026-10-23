import { error } from '@sveltejs/kit';
import { noteAccess } from '#lib/features/billing/server/paywall';
import { fileBytes } from '#lib/features/files/server/service';
import { noteForUser } from '#lib/features/notes/server/service';
import { requireUser, toHttp } from '#lib/server/http';
import type { RequestHandler } from './$types';

/**
 * A note's PDF streamed same-origin (R2 is cross-origin without CORS, so the browser could not cache it).
 * "Save offline" stores this response in the SAVED bucket; the SW serves it from there afterwards.
 */
export const GET: RequestHandler = async (event) => {
	const u = requireUser(event);
	const note = await noteForUser(u, event.params.slug).catch(toHttp);
	if (!note.fileId) error(404, 'This note has no PDF.');
	if (!(await noteAccess(u.id, note.id))) error(403, 'Unlock this note to download it.');
	const file = await fileBytes(note.fileId).catch(toHttp);
	const name = `${note.slug}.pdf`;
	return new Response(file.bytes, {
		headers: {
			'content-type': file.mime,
			'content-length': String(file.bytes.byteLength),
			'content-disposition': `inline; filename="${name}"`,
			'cache-control': 'private, no-store'
		}
	});
};
