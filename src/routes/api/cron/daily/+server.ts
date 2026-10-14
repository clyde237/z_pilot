import { error, json } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { CRON_SECRET } from '$app/env/private';
import { db } from '#lib/server/db/index.js';
import { runDailyNotificationCron } from '#lib/server/notifications.js';
import type { RequestHandler } from './$types';

function isAuthorized(authorizationHeader: string | null): boolean {
	const expected = Buffer.from(`Bearer ${CRON_SECRET}`);
	const received = Buffer.from(authorizationHeader ?? '');
	return received.length === expected.length && timingSafeEqual(received, expected);
}

// Called once a day by Vercel Cron (see vercel.json) (EF-NOT-05).
export const GET: RequestHandler = async ({ request }) => {
	if (!isAuthorized(request.headers.get('authorization'))) {
		error(401, 'Unauthorized');
	}

	const stats = await runDailyNotificationCron(db);
	return json({ ok: true, stats });
};
