import { expect, test } from '@playwright/test';
import { DEMO_ACCOUNTS, loginAs } from './helpers';

// W6 hardening: the original spec targeted /academics/examinations, a route
// that does not exist, and accepted a login redirect as success. The real mark
// entry surface is /academics/grades/entry (capability grading.read).
test.describe('E2E: Teacher Grade Entry', () => {
  test('grade entry page renders for a signed-in teacher', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.teacher);
    await page.goto('/fr/dashboard/academics/grades/entry');
    await expect(page).toHaveURL(/academics\/grades\/entry/);
    await expect(page).not.toHaveURL(/\/login/);
    // Authenticated dashboard shell renders (sidebar heading from the layout).
    await expect(page.getByRole('heading', { name: 'School OS' })).toBeVisible();
  });
});
