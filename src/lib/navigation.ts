import House from '@lucide/svelte/icons/house';
import UserRound from '@lucide/svelte/icons/user-round';
import UsersRound from '@lucide/svelte/icons/users-round';
import type { Component } from 'svelte';
import { meetsRequirement, type AccessRequirement, type RoleFlags } from '#lib/domain/roles.js';

export const NAVIGATION_SECTIONS = ['Suivi', 'Administration', 'Compte'] as const;

export interface NavigationItem {
	/** Route ID without parameters, passed to `resolve()`. */
	route: '/(app)/mon-espace' | '/(app)/admin/utilisateurs' | '/(app)/profil';
	label: string;
	icon: Component<{ class?: string; 'aria-hidden'?: 'true' }>;
	/** Same requirement as the route itself (see routeAccess): a link is shown only if usable. */
	requirement: AccessRequirement;
	section: (typeof NAVIGATION_SECTIONS)[number];
}

// Entries appear as their lot is delivered.
const NAVIGATION: NavigationItem[] = [
	{
		route: '/(app)/mon-espace',
		label: 'Mon espace',
		icon: House,
		requirement: 'member',
		section: 'Suivi'
	},
	{
		route: '/(app)/admin/utilisateurs',
		label: 'Utilisateurs',
		icon: UsersRound,
		requirement: 'admin',
		section: 'Administration'
	},
	{
		route: '/(app)/profil',
		label: 'Mon profil',
		icon: UserRound,
		requirement: 'authenticated',
		section: 'Compte'
	}
];

export function navigationFor(user: RoleFlags): NavigationItem[] {
	return NAVIGATION.filter((item) => meetsRequirement(user, item.requirement));
}
