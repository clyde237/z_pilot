import { error, json } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { markNotificationAsRead } from '#lib/server/notifications.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals);
	const body = await request.json().catch(() => null);

	if (!body || typeof body.id !== 'string') {
		error(400, 'Identifiant de notification requis.');
	}

	const success = await markNotificationAsRead(db, user.id, body.id);
	return json({ ok: success });
};
