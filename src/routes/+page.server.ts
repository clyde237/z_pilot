import { redirect } from '@sveltejs/kit';
import { homePathFor } from '#lib/domain/roles.js';
import { requireUser } from '#lib/server/auth/access.js';
import type { PageServerLoad } from './$types';

// The home page only dispatches to the right space; signed-out users never reach it
// (hooks.server.ts sends them to /login).
export const load: PageServerLoad = ({ locals }) => {
	redirect(303, homePathFor(requireUser(locals)));
};
