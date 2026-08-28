import { expect, test } from '@playwright/test';
import { DEMO_ACCOUNTS, loginAs } from './helpers';

// W6 hardening: the original spec targeted /settings/general (no such route)
// and guessed /dashboard/{role} paths, accepting a login redirect as pass.
// Real assertions: an anonymous user is bounced from a real admin page; a
// signed-in admin renders it.
test.describe('E2E: Role-Based Access to Admin Settings', () => {
  const ADMIN_PAGE = '/fr/dashboard/settings/branches';

  test('unauthenticated request to an admin page redirects to login', async ({ page }) => {
    await page.goto(ADMIN_PAGE);
    await expect(page).toHaveURL(/\/login/);
  });

  test('signed-in admin renders the admin settings page', async ({ page }) => {
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto(ADMIN_PAGE);
    await expect(page).toHaveURL(/settings\/branches/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'School OS' })).toBeVisible();
  });
});
