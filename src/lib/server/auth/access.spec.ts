import { describe, expect, it } from 'vitest';
import { routeAccess, safeRedirectPath } from './access';

describe('routeAccess', () => {
	it('protects each area with the role of the CDC rights matrix', () => {
		expect(routeAccess('/login')).toBe('public');
		expect(routeAccess('/logout')).toBe('public');
		expect(routeAccess('/api/cron/daily')).toBe('public');
		expect(routeAccess('/api/settings/logo')).toBe('public');
		expect(routeAccess('/admin/utilisateurs')).toBe('admin');
		expect(routeAccess('/equipe/objectifs')).toBe('chef');
		expect(routeAccess('/rapports/mensuel')).toBe('chef');
		expect(routeAccess('/mon-espace/2026-10-05')).toBe('member');
		expect(routeAccess('/mes-rapports')).toBe('member');
	});

	it('requires a signed-in user everywhere else', () => {
		expect(routeAccess('/')).toBe('authenticated');
		expect(routeAccess('/profil')).toBe('authenticated');
		expect(routeAccess('/changer-mot-de-passe')).toBe('authenticated');
	});

	it('matches whole path segments only', () => {
		expect(routeAccess('/administration')).toBe('authenticated');
		expect(routeAccess('/login-help')).toBe('authenticated');
	});
});

describe('safeRedirectPath', () => {
	it('keeps same-site paths', () => {
		expect(safeRedirectPath('/admin/utilisateurs?status=active')).toBe(
			'/admin/utilisateurs?status=active'
		);
	});

	it('rejects anything that could leave the site', () => {
		for (const target of [
			null,
			'',
			'https://evil.example',
			'//evil.example',
			'/\\evil.example',
			'javascript:alert(1)'
		]) {
			expect(safeRedirectPath(target)).toBeNull();
		}
	});
});
