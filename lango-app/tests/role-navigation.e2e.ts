import { expect, test } from '@playwright/test';
import { DEMO_ACCOUNTS, loginAs } from './helpers';

// Previously asserted `toHaveURL(/(\/login|\/dashboard)/)` without signing in.
// Since /dashboard also matches /fr/dashboard AND the login redirect matched the
// other branch, that assertion was true for essentially any outcome. It now
// checks two things that can actually fail: an authenticated admin reaches the
// dashboard, and a teacher is kept out of a super-admin route without the app
// crashing (a 500 on a denied route is a real defect this would catch).

test.describe('E2E: Role-Based Navigation and Sidebar Access Matrix', () => {
  test('authenticated admin reaches the dashboard', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto('/fr/dashboard');

    await expect(page).toHaveURL(/\/fr\/dashboard/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('teacher is denied a super-admin route without a crash', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.teacher);
    await page.goto('/fr/dashboard/super-admin');

    // The guard may redirect or render a denial; either is acceptable. What is
    // NOT acceptable is a server error, or a teacher landing on the real
    // super-admin screen.
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('body')).not.toContainText('Application error');

    const url = page.url();
    const stayedOnSuperAdmin = /\/dashboard\/super-admin/.test(url);
    expect(
      stayedOnSuperAdmin,
      `teacher was not redirected away from super-admin (landed on ${url})`,
    ).toBe(false);
  });
});
