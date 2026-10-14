import { z } from 'zod';

export const AUDIT_ACTIONS = [
	'all',
	'user.created',
	'user.updated',
	'user.deactivated',
	'user.reactivated',
	'user.password_reset',
	'user.password_changed',
	'user.locked',
	'settings.updated'
] as const;

export const auditFiltersSchema = z.object({
	q: z.string().trim().max(100).catch(''),
	action: z.enum(AUDIT_ACTIONS).catch('all'),
	page: z.coerce.number().int().min(1).catch(1)
});

export type AuditFilters = z.infer<typeof auditFiltersSchema>;
