import { expect, test } from '@playwright/test';

test('a signed-out visitor is sent to the login page', async ({ page }) => {
	await page.goto('/admin/utilisateurs');
	await expect(page).toHaveURL(/\/login\?redirectTo=%2Fadmin%2Futilisateurs$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connexion');
});
