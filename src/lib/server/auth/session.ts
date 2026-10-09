import type { Cookies } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import type { SessionUser } from '#lib/domain/roles.js';
import { sessions, settings, users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';

export const SESSION_COOKIE_NAME = 'z_pilot_session';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ValidatedSession {
	sessionId: string;
	user: SessionUser;
	expiresAt: Date;
	/** True when the expiry moved forward: the cookie must be sent again. */
	renewed: boolean;
}

export function generateSessionToken(): string {
	return randomBytes(32).toString('base64url');
}

// Only the hash is stored: a copy of the sessions table does not let anyone sign in.
function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

async function sessionDurationMs(db: Database): Promise<number> {
	const [row] = await db
		.select({ days: settings.sessionDurationDays })
		.from(settings)
		.where(eq(settings.id, 1));
	if (!row) throw new Error('The settings row is missing: run the database migrations.');
	return row.days * DAY_MS;
}

export async function createSession(
	db: Database,
	userId: string,
	token: string,
	now = new Date()
): Promise<{ sessionId: string; expiresAt: Date }> {
	const expiresAt = new Date(now.getTime() + (await sessionDurationMs(db)));
	const [session] = await db
		.insert(sessions)
		.values({ userId, tokenHash: hashToken(token), expiresAt })
		.returning({ id: sessions.id });
	return { sessionId: session.id, expiresAt };
}

/**
 * Returns the session and its user, or null when the token is unknown, expired, or
 * belongs to a deactivated account (RG-12). A session used during the second half of
 * its life is extended, so active users are not signed out (EF-AUT-02).
 */
export async function validateSessionToken(
	db: Database,
	token: string,
	now = new Date()
): Promise<ValidatedSession | null> {
	const [row] = await db
		.select({
			sessionId: sessions.id,
			expiresAt: sessions.expiresAt,
			active: users.active,
			sessionDurationDays: settings.sessionDurationDays,
			user: {
				id: users.id,
				username: users.username,
				fullName: users.fullName,
				isAdmin: users.isAdmin,
				isChef: users.isChef,
				participatesInReports: users.participatesInReports,
				mustChangePassword: users.mustChangePassword
			}
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.innerJoin(settings, eq(settings.id, 1))
		.where(eq(sessions.tokenHash, hashToken(token)));

	if (!row) return null;

	if (row.expiresAt <= now || !row.active) {
		await db.delete(sessions).where(eq(sessions.id, row.sessionId));
		return null;
	}

	const durationMs = row.sessionDurationDays * DAY_MS;
	if (row.expiresAt.getTime() - now.getTime() >= durationMs / 2) {
		return { sessionId: row.sessionId, user: row.user, expiresAt: row.expiresAt, renewed: false };
	}

	const expiresAt = new Date(now.getTime() + durationMs);
	await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, row.sessionId));
	return { sessionId: row.sessionId, user: row.user, expiresAt, renewed: true };
}

export async function invalidateSession(db: Database, sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Signs a user out everywhere, optionally keeping the session making the request. */
export async function invalidateUserSessions(
	db: Database,
	userId: string,
	options: { exceptSessionId?: string } = {}
): Promise<void> {
	await db
		.delete(sessions)
		.where(
			options.exceptSessionId
				? and(eq(sessions.userId, userId), ne(sessions.id, options.exceptSessionId))
				: eq(sessions.userId, userId)
		);
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date): void {
	// SvelteKit adds `Secure` everywhere except on http://localhost.
	cookies.set(SESSION_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
