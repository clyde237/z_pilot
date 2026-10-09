import { error } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { CRON_SECRET } from '$app/env/private';
import type { RequestHandler } from './$types';

function isAuthorized(authorizationHeader: string | null): boolean {
	const expected = Buffer.from(`Bearer ${CRON_SECRET}`);
	const received = Buffer.from(authorizationHeader ?? '');
	return received.length === expected.length && timingSafeEqual(received, expected);
}

// Called once a day by Vercel Cron (see vercel.json).
export const GET: RequestHandler = ({ request }) => {
	if (!isAuthorized(request.headers.get('authorization'))) error(401, 'Unauthorized');

	// Daily reminders and head alerts (EF-NOT-02, EF-NOT-03) arrive with lot 6.
	return new Response(null, { status: 501 });
};
