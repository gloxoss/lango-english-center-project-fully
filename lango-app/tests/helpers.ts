import type { Page } from '@playwright/test';

// Shared E2E login helper (W6): specs assert on real authenticated pages, so
// they need a real session. Credentials are the seeded Atlas demo accounts.
export const DEMO_ACCOUNTS = {
  admin: 'y.elamrani@atlas.ma',
  teacher: 'prof.01@atlas.ma',
  accountant: 'accountant@atlas.ma',
} as const;

export const DEMO_PASSWORD = 'Admin123!';

export async function loginAs(page: Page, email: string, password: string = DEMO_PASSWORD): Promise<void> {
  await page.goto('/fr/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
}
