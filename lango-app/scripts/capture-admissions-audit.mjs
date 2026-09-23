import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Logging in as School Admin...');
  await page.goto('http://localhost:3111/fr/login', { waitUntil: 'networkidle' });

  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  console.log('1. Capturing Admissions List (/dashboard/students/admissions)...');
  await page.goto('http://localhost:3111/fr/dashboard/students/admissions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const admissionsListPath = path.join(ARTIFACTS_DIR, 'admissions-list-initial.png');
  await page.screenshot({ path: admissionsListPath, fullPage: false });
  console.log(`Saved: ${admissionsListPath}`);

  console.log('2. Capturing New Admission Wizard Step 1 (/dashboard/students/admissions/new)...');
  await page.goto('http://localhost:3111/fr/dashboard/students/admissions/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const wizardStep1Path = path.join(ARTIFACTS_DIR, 'admissions-wizard-step1.png');
  await page.screenshot({ path: wizardStep1Path, fullPage: false });
  console.log(`Saved: ${wizardStep1Path}`);

  console.log('3. Capturing Arabic RTL Wizard (/ar/dashboard/students/admissions/new)...');
  await page.goto('http://localhost:3111/ar/dashboard/students/admissions/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const wizardArabicPath = path.join(ARTIFACTS_DIR, 'admissions-wizard-arabic.png');
  await page.screenshot({ path: wizardArabicPath, fullPage: false });
  console.log(`Saved: ${wizardArabicPath}`);

  console.log('4. Capturing Mobile Wizard...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3111/fr/dashboard/students/admissions/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const wizardMobilePath = path.join(ARTIFACTS_DIR, 'admissions-wizard-mobile.png');
  await page.screenshot({ path: wizardMobilePath, fullPage: false });
  console.log(`Saved: ${wizardMobilePath}`);

  await browser.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
