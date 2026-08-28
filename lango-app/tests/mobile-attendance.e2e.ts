import { expect, test, type Page } from '@playwright/test';

// W6: this suite originally assumed an anonymous hit on /fr/dashboard/attendance
// would render attendance UI; unauthenticated users are redirected to /fr/login,
// so the assertions were silently measuring the login page. It now signs in as a
// seeded teacher (tenant Atlas) before asserting on the real marking screen.
async function loginAsTeacher(page: Page): Promise<void> {
  await page.goto('/fr/login');
  await page.locator('input[type="email"]').fill('prof.01@atlas.ma');
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
}

test.describe('E2E: Teacher Mobile Attendance Marking (375px Viewport)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
  });

  test('attendance marking page layout adapts to 375px without horizontal scroll', async ({ page }) => {
    await page.goto('/fr/dashboard/attendance');
    // Verify page loads without horizontal body overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 5);
  });

  // Asserts 30px: passes WCAG 2.5.8 (24px min) but is BELOW the 44px Apple HIG /
  // Material ideal. Named for what it actually checks — raising the UI to 44px is
  // a product change, not a test change. See 19-RESPONSIVE-VIEWPORT-AUDIT.md §3.
  test('attendance status toggles meet the 30px touch-target floor (WCAG 2.5.8, below the 44px ideal)', async ({ page }) => {
    await page.goto('/fr/dashboard/attendance');
    // The status toggles are the only buttons rendered inside table cells of
    // the marking grid (attendance-client.tsx STATUS_OPTIONS). Measuring the
    // first buttons on the page grabbed 24px sidebar icon buttons instead —
    // not what this assertion is about (W6 fix).
    const toggles = page.locator('td button[type="button"]');
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 12); i++) {
      const box = await toggles.nth(i).boundingBox();
      if (box && box.height > 0) {
        expect(box.height).toBeGreaterThanOrEqual(30);
      }
    }
  });
});
