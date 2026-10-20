import { json } from '@sveltejs/kit';
import { upload } from '#lib/features/files/server/service';
import { DomainError, requireStaff, toHttp } from '#lib/server/http';
import type { RequestHandler } from './$types';

/** Multipart upload: fields `file` and `kind` ('image' | 'pdf'). Staff only. */
export const POST: RequestHandler = async (event) => {
	const user = requireStaff(event);
	try {
		const data = await event.request.formData().catch(() => {
			throw new DomainError(400, 'Send the file as multipart form data.');
		});
		const file = data.get('file');
		const kind = data.get('kind') ?? 'image';
		if (!(file instanceof File)) throw new DomainError(400, 'Choose a file to upload.');
		if (kind !== 'image' && kind !== 'pdf') throw new DomainError(400, 'Unknown file kind.');
		return json(await upload(file, user.id, kind), { status: 201 });
	} catch (e) {
		toHttp(e);
	}
};
