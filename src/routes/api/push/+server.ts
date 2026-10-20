import { error, json } from '@sveltejs/kit';
import { subscriptionInput, unsubscribeInput } from '#lib/features/push/schema';
import { subscribe, unsubscribe, vapid } from '#lib/features/push/server/service';
import { body, requireUser } from '#lib/server/http';
import type { RequestHandler } from './$types';

/** The VAPID public key the browser subscribes with (null = push not configured). */
export const GET: RequestHandler = (event) => {
	requireUser(event);
	return json({ publicKey: vapid()?.publicKey ?? null });
};

export const POST: RequestHandler = async (event) => {
	const u = requireUser(event);
	if (!vapid()) error(503, 'Notifications are not set up yet.');
	await subscribe(u.id, await body(event, subscriptionInput));
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const u = requireUser(event);
	await unsubscribe(u.id, (await body(event, unsubscribeInput)).endpoint);
	return json({ ok: true });
};
