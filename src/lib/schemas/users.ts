import { z } from 'zod';
import { USERNAME_PATTERN, USERNAME_RULE } from '#lib/domain/users.js';

/** Account creation and edition by an admin (EF-USR-01, EF-USR-02). */
export const userFormSchema = z
	.object({
		fullName: z
			.string()
			.trim()
			.min(2, 'Saisissez le nom complet.')
			.max(100, 'Au plus 100 caractères.'),
		username: z.string().trim().toLowerCase().regex(USERNAME_PATTERN, USERNAME_RULE),
		isAdmin: z.boolean().default(false),
		isChef: z.boolean().default(false),
		participatesInReports: z.boolean().default(true)
	})
	// Same rules as the DB checks users_chef_participates and users_non_admin_participates.
	.refine((data) => !data.isChef || data.participatesInReports, {
		path: ['participatesInReports'],
		message: 'Le chef de département participe toujours aux rapports.'
	})
	.refine((data) => data.isAdmin || data.participatesInReports, {
		path: ['participatesInReports'],
		message: 'Seul un administrateur peut être exclu des tâches et des rapports.'
	});

export type UserFormInput = z.infer<typeof userFormSchema>;

export const USER_STATUS_FILTERS = ['all', 'active', 'inactive'] as const;
export const USER_ROLE_FILTERS = ['all', 'admin', 'chef', 'member'] as const;

/** Search and filters of the user list (EF-USR-07), read from the query string. */
export const userListFiltersSchema = z.object({
	q: z.string().trim().max(100).catch(''),
	status: z.enum(USER_STATUS_FILTERS).catch('all'),
	role: z.enum(USER_ROLE_FILTERS).catch('all')
});

export type UserListFilters = z.infer<typeof userListFiltersSchema>;
