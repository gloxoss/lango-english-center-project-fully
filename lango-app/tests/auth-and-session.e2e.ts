import { expect, test } from '@playwright/test';

test.describe('E2E: Authentication, Session Management, and Role Routing', () => {
  test('unauthenticated request redirects to sign-in page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('public health endpoint responds 200 without authentication', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('healthy');
  });

  test('sign-in page renders with multi-tenant login form', async ({ page }) => {
    await page.goto('/fr/login');
    await expect(page.locator('input[type="email"], input[name="email"], input[name="identifier"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
