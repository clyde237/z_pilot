import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { meetsRequirement } from '#lib/domain/roles.js';
import { LOGIN_PATH, PASSWORD_CHANGE_PATH, routeAccess } from '#lib/server/auth/access.js';
import {
	SESSION_COOKIE_NAME,
	deleteSessionCookie,
	setSessionCookie,
	validateSessionToken
} from '#lib/server/auth/session.js';
import { db } from '#lib/server/db/index.js';

export const handle: Handle = async ({ event, resolve }) => {
	await authenticate(event);
	authorize(event);
	return resolve(event);
};

async function authenticate(event: RequestEvent): Promise<void> {
	event.locals.user = null;
	event.locals.sessionId = null;

	const token = event.cookies.get(SESSION_COOKIE_NAME);
	if (!token) return;

	const session = await validateSessionToken(db, token);
	if (!session) {
		deleteSessionCookie(event.cookies);
		return;
	}
	if (session.renewed) setSessionCookie(event.cookies, token, session.expiresAt);
	event.locals.user = session.user;
	event.locals.sessionId = session.sessionId;
}

/**
 * Every request — page, data request, form action, endpoint — goes through this check
 * (EF-AUT-06). Loads and actions repeat it with `requireUser`, as a second line.
 */
function authorize(event: RequestEvent): void {
	const access = routeAccess(event.url.pathname);
	if (access === 'public') return;

	const user = event.locals.user;
	if (!user) {
		if (event.request.method !== 'GET') error(401, 'Session expirée. Reconnectez-vous.');
		const target = event.url.pathname + event.url.search;
		redirect(
			303,
			target === '/' ? LOGIN_PATH : `${LOGIN_PATH}?redirectTo=${encodeURIComponent(target)}`
		);
	}

	// EF-AUT-03: until the password is changed, only that page (and the public sign-out)
	// is reachable.
	if (user.mustChangePassword && event.url.pathname !== PASSWORD_CHANGE_PATH) {
		redirect(303, PASSWORD_CHANGE_PATH);
	}

	if (!meetsRequirement(user, access)) error(403, 'Accès refusé');
}
