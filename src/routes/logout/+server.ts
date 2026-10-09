import { redirect } from '@sveltejs/kit';
import { LOGIN_PATH } from '#lib/server/auth/access.js';
import { deleteSessionCookie, invalidateSession } from '#lib/server/auth/session.js';
import { db } from '#lib/server/db/index.js';
import type { RequestHandler } from './$types';

// POST only: a link or an image cannot sign anyone out. SvelteKit checks the origin of
// form submissions (CSRF).
export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (locals.sessionId) await invalidateSession(db, locals.sessionId);
	deleteSessionCookie(cookies);
	redirect(303, LOGIN_PATH);
};
