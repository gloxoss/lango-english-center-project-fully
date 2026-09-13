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

  test('cashier journey: open register -> cash invoice collection -> session closing', async ({ page }) => {
    await page.goto('/fr/dashboard/finance/collection-desk');
    await expect(page).toHaveURL(/\/finance\/collection-desk/);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();

    // 1. Open Register if not already active
    const openRegisterBtn = page.getByRole('button', { name: /Ouvrir la Caisse/i });
    const closeRegisterBtn = page.getByRole('button', { name: /Fermer la Caisse/i });

    if (await openRegisterBtn.isVisible()) {
      await openRegisterBtn.click();
      const openModal = page.locator('.fixed').filter({ hasText: /Ouvrir une session de caisse/i });
      await expect(openModal).toBeVisible();
      const floatInput = openModal.locator('input[type="number"]').first();
      await floatInput.fill('500');
      const submitOpen = openModal.locator('button[type="submit"]');
      await submitOpen.click();
      await expect(openModal).not.toBeVisible({ timeout: 15_000 });
    }

    // Verify register is active and close button is visible
    await expect(closeRegisterBtn).toBeVisible({ timeout: 15_000 });

    // 2. Cash Invoice Collection
    // Try overdue invoices first
    const overdueTab = page.getByRole('button', { name: /Factures en retard/i });
    if (await overdueTab.isVisible()) {
      await overdueTab.click();
      const firstDueStudent = page.locator('div.divide-y button').first();
      if (await firstDueStudent.isVisible()) {
        await firstDueStudent.click();
      }
    }

    // Check if invoices are displayed for collection
    const collectBtn = page.getByRole('button', { name: /Encaisser/i });
    if (await collectBtn.isVisible()) {
      await collectBtn.click();
      const collectModal = page.locator('.fixed').filter({ hasText: /Encaissement/i });
      await expect(collectModal).toBeVisible();
      const confirmPaymentBtn = collectModal.getByRole('button', { name: /Confirmer l'encaissement/i });
      await confirmPaymentBtn.click();

      // Check receipt modal appears and close it
      const receiptModal = page.locator('.fixed').filter({ hasText: /Paiement Enregistré/i });
      if (await receiptModal.isVisible({ timeout: 10_000 })) {
        const closeReceipt = receiptModal.getByRole('button', { name: /Fermer/i });
        await closeReceipt.click();
        await expect(receiptModal).not.toBeVisible();
      }
    }

    // 3. Verify cashier sessions registry reflects session state
    await page.goto('/fr/dashboard/finance/cashier-sessions');
    await expect(page).toHaveURL(/\/finance\/cashier-sessions/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Internal Server Error');

    // 4. Session Closing
    await page.goto('/fr/dashboard/finance/collection-desk');
    await expect(page).toHaveURL(/\/finance\/collection-desk/);

    const closeBtn = page.getByRole('button', { name: /Fermer la Caisse/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    const closeModal = page.locator('.fixed').filter({ hasText: /Fermer la session de caisse/i });
    await expect(closeModal).toBeVisible();
    const countedInput = closeModal.locator('input[type="number"]').first();
    await countedInput.fill('500');
    const submitClose = closeModal.locator('button[type="submit"]');
    await submitClose.click();
    await expect(closeModal).not.toBeVisible({ timeout: 15_000 });

    // Verify session is closed (Open button reappears)
    await expect(page.getByRole('button', { name: /Ouvrir la Caisse/i })).toBeVisible({ timeout: 15_000 });
  });
});
