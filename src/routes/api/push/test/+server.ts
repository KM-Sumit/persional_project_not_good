import { error, json } from '@sveltejs/kit';
import { dev } from '$app/env';
import { pushTo } from '#lib/features/push/server/service';
import { requireUser } from '#lib/server/http';
import type { RequestHandler } from './$types';

/** Dev only: push a test notification to every device of the signed-in user. */
export const POST: RequestHandler = async (event) => {
	if (!dev) error(404, 'Not found');
	const u = requireUser(event);
	return json(await pushTo({ userIds: [u.id] }, { title: 'Test notification', body: 'Notifications are working on this device.', url: '/app/downloads' }));
};
