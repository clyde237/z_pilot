import { auditFiltersSchema } from '#lib/schemas/audit.js';
import { requireUser } from '#lib/server/auth/access.js';
import { listAuditLogs } from '#lib/server/audit.js';
import { db } from '#lib/server/db/index.js';
import type { PageServerLoad } from './$types';

// CDC §10 Traçabilité: Audit log viewer for administrators.
export const load: PageServerLoad = async ({ locals, url }) => {
	requireUser(locals, 'admin');
	const filters = auditFiltersSchema.parse(Object.fromEntries(url.searchParams));
	const result = await listAuditLogs(db, filters);

	return {
		filters,
		result
	};
};
