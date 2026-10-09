import { auditLog } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';

/** Sensitive actions recorded in the audit log (CDC §10, traceability). */
export type AuditAction =
	| 'user.created'
	| 'user.updated'
	| 'user.deactivated'
	| 'user.reactivated'
	| 'user.password_reset'
	| 'user.password_changed'
	| 'user.locked';

export interface AuditEntry {
	/** Null when the system acts, e.g. an automatic lockout. */
	actorId: string | null;
	action: AuditAction;
	entity: 'user';
	entityId: string;
	/** Never a password, a hash or a token. */
	details?: Record<string, unknown>;
}

/** Call it inside the transaction of the action, so the trace exists only if the action does. */
export async function recordAudit(db: Database, entry: AuditEntry): Promise<void> {
	await db.insert(auditLog).values({
		userId: entry.actorId,
		action: entry.action,
		entity: entry.entity,
		entityId: entry.entityId,
		details: entry.details ?? null
	});
}
