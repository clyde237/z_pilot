import { redirect } from '@sveltejs/kit';
import { currentWeekStart } from '#lib/domain/week.js';
import { requireUser } from '#lib/server/auth/access.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireUser(locals, 'member');
	redirect(303, `/mon-espace/${currentWeekStart()}`);
};
