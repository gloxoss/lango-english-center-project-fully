/**
 * E1 recheck — wait for sidebar to fully render, then look for scanner link.
 * Reception user sidebar may require expanding the Attendance group first.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const BASE = process.env.BASE ?? 'http://localhost:3485';
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../artifacts/product-enhancements/IMPL-ATTENDANCE-REFORM-01/screenshots'
);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type="email"]').fill('accueil@atlas.ma');
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 30000 }).catch(() => {});
  console.log('Logged in as reception. URL:', page.url());

  // Navigate to dashboard and wait for sidebar to fully compile + render
  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for any sidebar nav link to appear (signals compilation done)
  await page.waitForFunction(() => document.querySelectorAll('a[href]').length > 5, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const allLinks = await page.locator('a[href]').all();
  const hrefs = await Promise.all(allLinks.map(l => l.getAttribute('href').catch(() => '')));
  const scannerLinks = hrefs.filter(h => h && h.includes('attendance/scanner'));
  console.log('All hrefs found:', hrefs.filter(Boolean).slice(0, 30));
  console.log('Scanner links:', scannerLinks);

  await page.screenshot({ path: path.join(OUT, 'E1-recheck-sidebar-expanded.png'), fullPage: false });

  // Try clicking any "Présence" or "Attendance" group to expand it
  const attendanceGroup = page.locator('button, [role="button"]').filter({ hasText: /présence|attendance/i });
  const groupCount = await attendanceGroup.count();
  console.log('Attendance group buttons found:', groupCount);
  if (groupCount > 0) {
    await attendanceGroup.first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, 'E1-recheck-after-expand.png'), fullPage: false });
    const scannerAfter = await page.locator('a[href*="attendance/scanner"]').count();
    console.log('Scanner links after expand:', scannerAfter);
  }

  // Final check
  const finalScannerCount = await page.locator('a[href*="attendance/scanner"]').count();
  console.log('\nResult:', finalScannerCount > 0 ? 'PASS — scanner link found' : 'FAIL — scanner link not found');

  await ctx.close();
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
