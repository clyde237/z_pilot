import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { auditLog, users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';

/** Sensitive actions recorded in the audit log (CDC §10, traceability). */
export type AuditAction =
	| 'user.created'
	| 'user.updated'
	| 'user.deactivated'
	| 'user.reactivated'
	| 'user.password_reset'
	| 'user.password_changed'
	| 'user.locked'
	| 'settings.updated';

export interface AuditEntry {
	/** Null when the system acts, e.g. an automatic lockout. */
	actorId: string | null;
	action: AuditAction;
	entity: 'user' | 'settings' | 'task' | 'weekly_report' | 'monthly_report';
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

export interface AuditLogActor {
	id: string;
	username: string;
	fullName: string;
}

export interface AuditLogItem {
	id: string;
	action: string;
	entity: string;
	entityId: string | null;
	details: Record<string, unknown> | null;
	createdAt: Date;
	actor: AuditLogActor | null;
}

export interface AuditLogResult {
	entries: AuditLogItem[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const AUDIT_PAGE_SIZE = 25;

export async function listAuditLogs(
	db: Database,
	filters: { q?: string; action?: string; page?: number; pageSize?: number }
): Promise<AuditLogResult> {
	const page = Math.max(1, filters.page ?? 1);
	const pageSize = filters.pageSize ?? AUDIT_PAGE_SIZE;
	const offset = (page - 1) * pageSize;

	const conditions: SQL[] = [];

	if (filters.action && filters.action !== 'all') {
		conditions.push(eq(auditLog.action, filters.action));
	}

	if (filters.q) {
		const pattern = `%${escapeLikePattern(filters.q)}%`;
		conditions.push(
			or(
				ilike(users.fullName, pattern),
				ilike(users.username, pattern),
				ilike(auditLog.action, pattern),
				ilike(auditLog.entityId, pattern)
			)!
		);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const [countResult] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(auditLog)
		.leftJoin(users, eq(auditLog.userId, users.id))
		.where(whereClause);

	const total = countResult?.count ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const rows = await db
		.select({
			id: auditLog.id,
			action: auditLog.action,
			entity: auditLog.entity,
			entityId: auditLog.entityId,
			details: auditLog.details,
			createdAt: auditLog.createdAt,
			actorId: users.id,
			actorUsername: users.username,
			actorFullName: users.fullName
		})
		.from(auditLog)
		.leftJoin(users, eq(auditLog.userId, users.id))
		.where(whereClause)
		.orderBy(desc(auditLog.createdAt))
		.limit(pageSize)
		.offset(offset);

	const entries: AuditLogItem[] = rows.map((r) => ({
		id: r.id,
		action: r.action,
		entity: r.entity,
		entityId: r.entityId,
		details: r.details as Record<string, unknown> | null,
		createdAt: r.createdAt,
		actor: r.actorId
			? {
					id: r.actorId,
					username: r.actorUsername!,
					fullName: r.actorFullName!
				}
			: null
	}));

	return {
		entries,
		total,
		page,
		pageSize,
		totalPages
	};
}
