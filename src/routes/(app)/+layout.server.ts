import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { getUnreadNotificationsCount, listUserNotifications } from '#lib/server/notifications.js';
import type { LayoutServerLoad } from './$types';

// Only session fields and notifications (EF-NOT-01).
export const load: LayoutServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const unreadCount = await getUnreadNotificationsCount(db, user.id);
	const recentNotifications = await listUserNotifications(db, user.id, { limit: 8 });

	return {
		user,
		unreadCount,
		recentNotifications
	};
};
