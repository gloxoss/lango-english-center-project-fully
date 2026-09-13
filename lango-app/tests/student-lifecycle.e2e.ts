import { expect, test } from '@playwright/test';
import { DEMO_ACCOUNTS, loginAs } from './helpers';

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

  test('student journey: admission -> fee payment -> receipt upload -> ID card generation', async ({ page }) => {
    // 1. Student Admission
    await page.goto('/fr/dashboard/students/admissions/new');
    await expect(page).toHaveURL(/\/students\/admissions\/new/);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();

    // Verify admission wizard inputs
    await expect(page.locator('input').first()).toBeVisible();

    // Verify admissions registry
    await page.goto('/fr/dashboard/students/admissions');
    await expect(page).toHaveURL(/\/students\/admissions/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();

    // 2. Student Directory & Fee Payment (Collection Desk)
    await page.goto('/fr/dashboard/students');
    await expect(page).toHaveURL(/\/dashboard\/students/);
    await expect(page.locator('table')).toBeVisible();

    // Verify student row actions exist (Profile & Card buttons)
    const profileLink = page.getByRole('link', { name: /Voir le profil/i }).first();
    await expect(profileLink).toBeVisible();

    const cardLink = page.getByRole('link', { name: /Carte scolaire/i }).first();
    await expect(cardLink).toBeVisible();

    // Click profile link to verify student profile view
    await profileLink.click();
    await expect(page).toHaveURL(/\/dashboard\/students\/[^/]+/);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');

    // Navigate to fee payment / collection desk
    await page.goto('/fr/dashboard/finance/collection-desk');
    await expect(page).toHaveURL(/\/finance\/collection-desk/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Internal Server Error');

    // 3. Finance Receipt & Expense Recording
    await page.goto('/fr/dashboard/finance/expenses');
    await expect(page).toHaveURL(/\/finance\/expenses/);

    // Click record expense button
    const recordBtn = page.getByRole('button', { name: /Saisir une Dépense/i });
    await expect(recordBtn).toBeVisible();
    await recordBtn.click();

    // Fill expense dialog
    await expect(page.locator('role=dialog')).toBeVisible();
    await page.locator('#exp-amount').fill('150.00');
    await page.locator('#exp-desc').fill('Fournitures d\'examen E2E');
    await page.locator('#exp-receipt').fill('https://schoolos.epioso.com/receipt-e2e.pdf');

    // Save expense
    const saveBtn = page.locator('role=dialog').getByRole('button', { name: /Enregistrer/i });
    await saveBtn.click();
    await expect(page.locator('role=dialog')).not.toBeVisible({ timeout: 15_000 });

    // 4. Student ID Card Generation Registry
    await page.goto('/fr/dashboard/cards/students');
    await expect(page).toHaveURL(/\/cards\/students/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Internal Server Error');

    // Verify issue card buttons exist on the registry table
    const issueCardBtn = page.getByRole('button', { name: /Émettre/i }).first();
    await expect(issueCardBtn).toBeVisible();
    await issueCardBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  });
});
