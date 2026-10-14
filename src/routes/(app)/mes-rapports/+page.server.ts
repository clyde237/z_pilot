import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { getMemberPublishedReports } from '#lib/server/reports.js';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals, 'member');
	const reports = await getMemberPublishedReports(db, user.id);

	return {
		reports
	};
};
