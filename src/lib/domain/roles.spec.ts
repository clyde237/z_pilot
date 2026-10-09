import { describe, expect, it } from 'vitest';
import { homePathFor, meetsRequirement, roleLabels, type RoleFlags } from './roles';

const member: RoleFlags = { isAdmin: false, isChef: false, participatesInReports: true };
const chef: RoleFlags = { isAdmin: false, isChef: true, participatesInReports: true };
const technicalAdmin: RoleFlags = { isAdmin: true, isChef: false, participatesInReports: false };
const adminAndChef: RoleFlags = { isAdmin: true, isChef: true, participatesInReports: true };

describe('meetsRequirement', () => {
	it('follows the CDC rights matrix', () => {
		expect(meetsRequirement(member, 'member')).toBe(true);
		expect(meetsRequirement(member, 'chef')).toBe(false);
		expect(meetsRequirement(member, 'admin')).toBe(false);
		expect(meetsRequirement(chef, 'member')).toBe(true);
		expect(meetsRequirement(chef, 'admin')).toBe(false);
		expect(meetsRequirement(technicalAdmin, 'member')).toBe(false);
		expect(meetsRequirement(technicalAdmin, 'chef')).toBe(false);
	});

	it('gives the union of the rights to an admin who is also the head', () => {
		for (const requirement of ['authenticated', 'member', 'chef', 'admin'] as const) {
			expect(meetsRequirement(adminAndChef, requirement)).toBe(true);
		}
	});
});

describe('homePathFor', () => {
	it('opens the personal space, or the account list for a technical admin', () => {
		expect(homePathFor(member)).toBe('/mon-espace');
		expect(homePathFor(adminAndChef)).toBe('/mon-espace');
		expect(homePathFor(technicalAdmin)).toBe('/admin/utilisateurs');
	});
});

describe('roleLabels', () => {
	it('names every role held', () => {
		expect(roleLabels(member)).toEqual(['Membre']);
		expect(roleLabels(adminAndChef)).toEqual(['Administrateur', 'Chef de département']);
		expect(roleLabels(technicalAdmin)).toEqual(['Administrateur']);
	});
});
