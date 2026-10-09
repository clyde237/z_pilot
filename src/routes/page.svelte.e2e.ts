import { expect, test } from '@playwright/test';

test('home page shows the application name', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Z_Pilot — Hôtel Zingana');
});
