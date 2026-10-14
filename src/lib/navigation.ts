import House from '@lucide/svelte/icons/house';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import Settings from '@lucide/svelte/icons/settings';
import Target from '@lucide/svelte/icons/target';
import UserRound from '@lucide/svelte/icons/user-round';
import UsersRound from '@lucide/svelte/icons/users-round';
import type { Component } from 'svelte';
import { meetsRequirement, type AccessRequirement, type RoleFlags } from '#lib/domain/roles.js';

export const NAVIGATION_SECTIONS = ['Suivi', 'Administration', 'Compte'] as const;

export interface NavigationItem {
	/** Route ID without parameters, passed to `resolve()`. */
	route:
		| '/(app)/mon-espace'
		| '/(app)/equipe/objectifs'
		| '/(app)/admin/utilisateurs'
		| '/(app)/admin/parametres'
		| '/(app)/admin/journal'
		| '/(app)/profil';
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
		route: '/(app)/equipe/objectifs',
		label: 'Objectifs équipe',
		icon: Target,
		requirement: 'chef',
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
		route: '/(app)/admin/parametres',
		label: 'Paramètres',
		icon: Settings,
		requirement: 'admin',
		section: 'Administration'
	},
	{
		route: '/(app)/admin/journal',
		label: 'Journal d’audit',
		icon: ScrollText,
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
