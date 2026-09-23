import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';
const GUARDIAN_ID = '299bbbe0-f75e-4c82-b117-3e9e89c56e9f';

async function main() {
  console.log('Capturing Evidence O: Link child modal checkboxes...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:3111/fr/login', { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  // Go to guardian profile
  await page.goto(`http://localhost:3111/fr/dashboard/students/parents/${GUARDIAN_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Click "+ Lier un enfant"
  const linkBtn = page.locator('button:has-text("Lier un enfant")').first();
  await linkBtn.waitFor({ state: 'visible', timeout: 8000 });
  await linkBtn.click({ force: true });
  await page.waitForTimeout(1500);

  // Check the checkboxes so we can see their blue color
  const checkboxes = page.locator('div[role="dialog"] input[type="checkbox"]');
  const count = await checkboxes.count();
  console.log(`Found ${count} checkboxes in modal`);
  for (let i = 0; i < count; i++) {
    const cb = checkboxes.nth(i);
    if (!(await cb.isChecked())) {
      await cb.click({ force: true });
    }
  }
  await page.waitForTimeout(500);

  const pathO = path.join(ARTIFACTS_DIR, 'guardians-o-modal-checkboxes-clean.png');
  await page.screenshot({ path: pathO, fullPage: false });
  console.log('Saved Evidence O to', pathO);

  await browser.close();
}

main().catch(err => {
  console.error('Error during Evidence O capture:', err);
  process.exit(1);
});
