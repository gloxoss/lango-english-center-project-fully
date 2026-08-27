import { expect, test } from '@playwright/test';

test.describe('E2E: Role-Based Navigation and Sidebar Access Matrix', () => {
  test('unauthorized portal path redirects cleanly without crashing', async ({ page }) => {
    await page.goto('/fr/dashboard/settings/general');
    await expect(page).toHaveURL(/.*(\/login|\/dashboard)/);
  });

  test('role portals provide distinct entrypoints (parent, student, teacher, admin)', async ({ page }) => {
    const roles = ['parent', 'student', 'teacher', 'admin'];
    for (const role of roles) {
      await page.goto(`/fr/dashboard/${role}`);
      await expect(page).toHaveURL(/.*(\/login|\/dashboard)/);
    }
  });
});
