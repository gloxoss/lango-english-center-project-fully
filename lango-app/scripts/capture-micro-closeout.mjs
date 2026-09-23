import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';
const GUARDIAN_ID = '299bbbe0-f75e-4c82-b117-3e9e89c56e9f'; // Tariq Benjelloun

async function main() {
  console.log('Launching browser for Micro-Closeout Evidence...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();

  // Login
  console.log('Logging in as School Admin...');
  await page.goto('http://localhost:3111/fr/login', { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  // 1. Capture Arabic RTL directory with localized relationship label ("ولي أمر")
  console.log('Capturing Evidence N: Arabic RTL clean directory with localized relationship...');
  await page.goto('http://localhost:3111/ar/dashboard/students/parents', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const pathN = path.join(ARTIFACTS_DIR, 'guardians-n-arabic-rtl-clean.png');
  await page.screenshot({ path: pathN, fullPage: false });
  console.log('Saved Evidence N to', pathN);

  // 2. Capture French Activity tab with human-readable entity label ("Responsabilité tuteur–élève")
  console.log('Capturing Evidence M: Activity tab with hidden internal entity label...');
  await page.goto(`http://localhost:3111/fr/dashboard/students/parents/${GUARDIAN_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const activityTab = page.locator('button:has-text("Activité"), [role="tab"]:has-text("Activité")').first();
  if (await activityTab.isVisible()) {
    await activityTab.click({ force: true });
    await page.waitForTimeout(2000);
  }
  const pathM = path.join(ARTIFACTS_DIR, 'guardians-m-activity-proven.png');
  await page.screenshot({ path: pathM, fullPage: false });
  console.log('Saved Evidence M to', pathM);

  console.log('Micro-closeout captures completed successfully!');
  await browser.close();
}

main().catch(err => {
  console.error('Error during micro-closeout capture:', err);
  process.exit(1);
});
