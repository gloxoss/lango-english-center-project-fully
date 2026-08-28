import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DEMO_ACCOUNTS, loginAs } from './helpers';

// TEMPORARY evidence-capture spec for W10 doc 19 (responsive audit).
// Captures real screenshots at the audited viewports, then this file is
// deleted after the run — it is evidence tooling, not a regression test.
const ASSETS = path.join(
  process.cwd(), '..', 'docs', 'audit', '2026-08-26', 'assets',
);

for (const vp of [
  { w: 320, h: 690, tag: '320' },
  { w: 375, h: 667, tag: '375' },
  { w: 768, h: 1024, tag: '768' },
  { w: 1440, h: 900, tag: '1440' },
]) {
  test(`capture attendance @${vp.tag}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await loginAs(page, DEMO_ACCOUNTS.teacher);
    await page.goto('/fr/dashboard/attendance');
    await expect(page.getByRole('heading', { name: 'School OS' })).toBeVisible();
    const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
    // eslint-disable-next-line no-console
    console.log(`attendance @${vp.tag}px horizontal overflow: ${overflow}px`);
    await page.screenshot({ path: path.join(ASSETS, `attendance-${vp.tag}.png`), fullPage: true });
  });

  test(`capture student directory @${vp.tag}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await loginAs(page, DEMO_ACCOUNTS.admin);
    await page.goto('/fr/dashboard/students');
    await expect(page.getByRole('heading', { name: 'School OS' })).toBeVisible();
    const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
    // eslint-disable-next-line no-console
    console.log(`students @${vp.tag}px horizontal overflow: ${overflow}px`);
    await page.screenshot({ path: path.join(ASSETS, `students-${vp.tag}.png`), fullPage: true });
  });
}

test('capture login fr @375px and login ar @375px (RTL)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/fr/login');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.screenshot({ path: path.join(ASSETS, 'login-fr-375.png'), fullPage: true });
  await page.goto('/ar/login');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  const dir = await page.getAttribute('html', 'dir');
  // eslint-disable-next-line no-console
  console.log(`ar login html dir: ${dir}`);
  await page.screenshot({ path: path.join(ASSETS, 'login-ar-375-rtl.png'), fullPage: true });
  expect(dir).toBe('rtl');
});
