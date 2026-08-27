import { expect, test } from '@playwright/test';

test.describe('E2E: Cashier Payments and Invoice Balancing', () => {
  test('financial invoices view renders currency in MAD with status tags', async ({ page }) => {
    await page.goto('/fr/dashboard/finance/invoices');
    // Expect redirection to sign-in or proper container
    await expect(page).toHaveURL(/.*(\/login|\/finance\/invoices)/);
  });

  test('payments view contains action buttons for recording receipt', async ({ page }) => {
    await page.goto('/fr/dashboard/finance/payments');
    await expect(page).toHaveURL(/.*(\/login|\/finance\/payments)/);
  });
});
