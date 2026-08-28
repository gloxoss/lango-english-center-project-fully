import { expect, test } from '@playwright/test';
import { DEMO_ACCOUNTS, loginAs } from './helpers';

// Previously asserted `toHaveURL(/(\/login|\/dashboard\/students)/)` without
// signing in, so the login redirect satisfied it and the test could not fail.
// Now signs in as the seeded school admin and asserts on the real pages.

test.describe('E2E: Student Lifecycle, Admissions, and Directory', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
  });

  test('student directory loads for an authenticated admin', async ({ page }) => {
    await page.goto('/fr/dashboard/students');

    await expect(page).toHaveURL(/\/dashboard\/students/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('admissions page loads for an authenticated admin', async ({ page }) => {
    await page.goto('/fr/dashboard/students/admissions');

    await expect(page).toHaveURL(/\/students\/admissions/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
