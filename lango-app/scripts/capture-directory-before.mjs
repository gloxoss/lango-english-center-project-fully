import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Logging in...');
  await page.goto('http://localhost:3111/fr/login', { waitUntil: 'networkidle' });

  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  console.log('Navigating to Student Directory...');
  await page.goto('http://localhost:3111/fr/dashboard/students', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const dirPath = path.join(ARTIFACTS_DIR, 'student-directory-before.png');
  await page.screenshot({ path: dirPath, fullPage: false });
  console.log(`Saved Directory Before: ${dirPath}`);

  await browser.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
