import { fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import {
	getUnreadNotificationsCount,
	listUserNotifications,
	markAllNotificationsAsRead,
	markNotificationAsRead
} from '#lib/server/notifications.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const [allNotifications, unreadCount] = await Promise.all([
		listUserNotifications(db, user.id, { limit: 100 }),
		getUnreadNotificationsCount(db, user.id)
	]);

	return {
		allNotifications,
		unreadCount
	};
};

export const actions: Actions = {
	markAllRead: async ({ locals }) => {
		const user = requireUser(locals);
		await markAllNotificationsAsRead(db, user.id);
		return { success: true };
	},

	markRead: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const id = form.get('id');

		if (!id || typeof id !== 'string') {
			return fail(400, { error: 'Identifiant invalide.' });
		}

		await markNotificationAsRead(db, user.id, id);
		return { success: true };
	}
};
