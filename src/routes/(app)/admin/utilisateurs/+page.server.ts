import { userListFiltersSchema } from '#lib/schemas/users.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { listAccounts } from '#lib/server/users.js';
import type { PageServerLoad } from './$types';

// EF-USR-07: search and filters run in the database, from the query string.
export const load: PageServerLoad = async ({ locals, url }) => {
	requireUser(locals, 'admin');
	const filters = userListFiltersSchema.parse(Object.fromEntries(url.searchParams));
	return { filters, accounts: await listAccounts(db, filters) };
};
