import { expect, test } from '@playwright/test';
import { DEMO_ACCOUNTS, loginAs } from './helpers';

// These specs previously asserted `toHaveURL(/(\/login|\/finance\/invoices)/)`
// without ever signing in. Unauthenticated hits redirect to /login, so the
// alternation matched the redirect and the tests could not fail — they would
// have stayed green with the finance module deleted. They now sign in as the
// seeded accountant and assert on the real page, so a redirect back to /login
// (a broken guard, a 500, a missing route) fails the test.

test.describe('E2E: Cashier Payments and Invoice Balancing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.accountant);
  });

  test('invoices view loads for an authenticated accountant', async ({ page }) => {
    await page.goto('/fr/dashboard/finance/invoices');

    // No `|login` alternation: landing back on login is now a failure.
    await expect(page).toHaveURL(/\/finance\/invoices/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('payments redirects to the collection desk, which renders', async ({ page }) => {
    await page.goto('/fr/dashboard/finance/payments');

    // /finance/payments is a deliberate redirect stub; collection-desk is the
    // real screen (see finance/payments/page.tsx). Asserting the destination
    // proves both the redirect and the page it lands on. The previous
    // `(login|payments)` assertion matched the login redirect and never
    // discovered this route existed at all.
    await expect(page).toHaveURL(/\/finance\/collection-desk/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });
});
