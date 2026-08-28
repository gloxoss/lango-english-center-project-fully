import { expect, test } from '@playwright/test';
import { DEMO_ACCOUNTS, loginAs } from './helpers';

// W6 hardening: originally accepted "login OR target" URL patterns, so both
// tests passed on an anonymous redirect without rendering anything. Now signs
// in and asserts the student directory and admissions pages actually render.
test.describe('E2E: Student Directory and Admissions', () => {
  test('student directory renders for a signed-in admin', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto('/fr/dashboard/students');
    await expect(page).toHaveURL(/dashboard\/students$/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'School OS' })).toBeVisible();
  });

  test('admissions page renders for a signed-in admin', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto('/fr/dashboard/students/admissions');
    await expect(page).toHaveURL(/students\/admissions/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'School OS' })).toBeVisible();
  });
});
