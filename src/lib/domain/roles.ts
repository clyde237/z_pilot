/**
 * Role flags of an account (CDC §2). An admin and the department head may be the same
 * person. "Member" means taking part in tasks and reports: always true for the head,
 * optional only for an admin (EF-USR-06).
 */
export interface RoleFlags {
	isAdmin: boolean;
	isChef: boolean;
	participatesInReports: boolean;
}

/** The signed-in user as known to every request. Never carries the password hash. */
export interface SessionUser extends RoleFlags {
	id: string;
	username: string;
	fullName: string;
	mustChangePassword: boolean;
}

/** What a page, an action or a navigation entry requires from the signed-in user. */
export type AccessRequirement = 'authenticated' | 'member' | 'chef' | 'admin';

/**
 * Single answer to "may this user do X?". Route protection, page loads and the
 * navigation menu all ask this function, so they cannot disagree.
 */
export function meetsRequirement(user: RoleFlags, requirement: AccessRequirement): boolean {
	switch (requirement) {
		case 'authenticated':
			return true;
		case 'member':
			return user.participatesInReports;
		case 'chef':
			return user.isChef;
		case 'admin':
			return user.isAdmin;
	}
}

/** Page shown right after sign-in. A purely technical admin has no personal space. */
export function homePathFor(user: RoleFlags): string {
	return user.participatesInReports ? '/mon-espace' : '/admin/utilisateurs';
}

export function roleLabels(user: RoleFlags): string[] {
	const labels: string[] = [];
	if (user.isAdmin) labels.push('Administrateur');
	if (user.isChef) labels.push('Chef de département');
	else if (user.participatesInReports) labels.push('Membre');
	return labels;
}
