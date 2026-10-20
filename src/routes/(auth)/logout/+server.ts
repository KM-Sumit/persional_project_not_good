import { redirect } from '@sveltejs/kit';
import { endSession } from '#lib/server/auth/session';
import { bumpSessionVersion } from '#lib/features/auth/server/service';
import type { RequestHandler } from './$types';

// POST only (a <form method="post" action="/logout">), so a stray link or prefetch can't sign anyone out.
// Bumping sessionVersion signs out every device holding a copy of the token.
export const POST: RequestHandler = async ({ cookies, locals }) => {
	if (locals.user) await bumpSessionVersion(locals.user.id).catch((e) => console.error('[auth] logout bump failed', e));
	endSession(cookies);
	redirect(303, '/');
};
