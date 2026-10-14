import { json } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { markAllNotificationsAsRead } from '#lib/server/notifications.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	const count = await markAllNotificationsAsRead(db, user.id);
	return json({ ok: true, count });
};
