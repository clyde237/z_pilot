import { error } from '@sveltejs/kit';
import { meetsRequirement, type AccessRequirement, type SessionUser } from '#lib/domain/roles.js';

export type RouteAccess = 'public' | AccessRequirement;

export const LOGIN_PATH = '/login';
export const PASSWORD_CHANGE_PATH = '/changer-mot-de-passe';
export const LOGOUT_PATH = '/logout';

// CDC §8 routes. First matching prefix wins; any other route needs a signed-in user.
const ROUTE_ACCESS: ReadonlyArray<readonly [prefix: string, access: RouteAccess]> = [
	[LOGIN_PATH, 'public'],
	// Signing out must work even with an expired session.
	[LOGOUT_PATH, 'public'],
	// Authenticated by CRON_SECRET inside the route.
	['/api/cron', 'public'],
	['/admin', 'admin'],
	['/equipe', 'chef'],
	['/rapports', 'chef'],
	['/mon-espace', 'member'],
	['/mes-rapports', 'member']
];

export function routeAccess(pathname: string): RouteAccess {
	for (const [prefix, access] of ROUTE_ACCESS) {
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return access;
	}
	return 'authenticated';
}

/**
 * Returns the signed-in user when they meet the requirement, otherwise stops the
 * request. Page loads and actions call it in addition to the global check in
 * hooks.server.ts, and it also gives them a non-null user.
 */
export function requireUser(
	locals: App.Locals,
	requirement: AccessRequirement = 'authenticated'
): SessionUser {
	const user = locals.user;
	if (!user) error(401, 'Connexion requise.');
	if (!meetsRequirement(user, requirement)) error(403, 'Accès refusé');
	return user;
}

/**
 * Only same-site paths are accepted after sign-in: `//host` or `/\host` would send the
 * user to another site (open redirect).
 */
export function safeRedirectPath(target: string | null): string | null {
	if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
		return null;
	}
	return target;
}
