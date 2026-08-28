import { expect, test } from '@playwright/test';
import { DEMO_ACCOUNTS, loginAs } from './helpers';

// Previously asserted `toHaveURL(/(\/login|\/academics\/examinations)/)` without
// signing in. Two problems: the alternation matched the login redirect so the
// test could not fail, and `/academics/examinations` and `/academics/grades` do
// not exist as routes at all — the real ones are `/academics/exams` and
// `/academics/grades/entry`. A test that passes against a nonexistent route is
// worse than no test. Now signs in as a seeded teacher and hits the real pages.

test.describe('E2E: Teacher Grade Entry and Moroccan Scale Boundaries', () => {
  // The exams page guards on `academics.manage`, which teachers deliberately do
  // NOT hold (permissions.ts) — a teacher hitting it is redirected to /fr. That
  // is correct authorization, so this case uses an admin. Verified by writing it
  // as a teacher first and watching it fail on the redirect.
  test('exams page loads for an admin who holds academics.manage', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto('/fr/dashboard/academics/exams');

    await expect(page).toHaveURL(/\/academics\/exams/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('teacher without academics.manage is redirected away from exams', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.teacher);
    await page.goto('/fr/dashboard/academics/exams');

    await expect(page).not.toHaveURL(/\/academics\/exams/);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('grade entry page loads for an authenticated teacher', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.teacher);
    await page.goto('/fr/dashboard/academics/grades/entry');

    await expect(page).toHaveURL(/\/academics\/grades\/entry/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
