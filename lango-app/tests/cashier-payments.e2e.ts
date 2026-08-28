import { expect, test } from '@playwright/test';
import { DEMO_ACCOUNTS, loginAs } from './helpers';

// W6 hardening: these specs originally accepted "login page OR target page"
// in the URL regex, so an unauthenticated redirect made them pass without
// testing anything. They now sign in and assert the real page rendered.
test.describe('E2E: Cashier Payments and Invoice Balancing', () => {
  test('invoices view renders for a signed-in admin (KPI rail)', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto('/fr/dashboard/finance/invoices');
    // Authorized: the URL stays on the invoices page instead of bouncing to login.
    await expect(page).toHaveURL(/finance\/invoices/);
    await expect(page).not.toHaveURL(/\/login/);
    // Static KPI label from invoices-view.tsx — proves the view itself mounted.
    await expect(page.getByText('Factures émises')).toBeVisible();
  });

  test('payments entry redirects to the real Collection Desk (documented behavior)', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto('/fr/dashboard/finance/payments');
    // payments/page.tsx redirects the legacy mock to the built collection desk.
    await expect(page).toHaveURL(/finance\/collection-desk/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
