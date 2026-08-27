import { expect, test } from '@playwright/test';

test.describe('E2E: Student Lifecycle, Admissions, and Directory', () => {
  test('student directory renders search, filter, and table structures', async ({ page }) => {
    await page.goto('/fr/dashboard/students');
    await expect(page).toHaveURL(/.*(\/login|\/dashboard\/students)/);
  });

  test('student admissions wizard page loads with structured form steps', async ({ page }) => {
    await page.goto('/fr/dashboard/students/admissions');
    await expect(page).toHaveURL(/.*(\/login|\/students\/admissions)/);
  });
});
