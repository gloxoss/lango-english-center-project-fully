import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACT_DIR = path.resolve('artifacts/page-audit/done/AUD-ADMISSIONS-02__admissions-enrollment');
const SCREENSHOTS_DIR = path.join(ARTIFACT_DIR, 'screenshots');
const EVIDENCE_DIR = path.join(ARTIFACT_DIR, 'evidence');
const IDE_ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\3f7760ab-b1f3-4f08-ba0a-c7749d5301e5';

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

async function saveScreenshot(page, filename) {
  const targetPath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: targetPath, fullPage: false });
  console.log(`Saved screenshot: ${filename}`);
  if (fs.existsSync(IDE_ARTIFACTS_DIR)) {
    try {
      fs.copyFileSync(targetPath, path.join(IDE_ARTIFACTS_DIR, filename));
    } catch (e) {}
  }
}

function hasScreenshot(filename) {
  const targetPath = path.join(SCREENSHOTS_DIR, filename);
  return fs.existsSync(targetPath) && fs.statSync(targetPath).size > 10000;
}

async function main() {
  console.log('Starting Playwright Admissions Audit Capture (Remaining)...');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();

  console.log('Logging in as school_admin (y.elamrani@atlas.ma)...');
  await page.goto('http://localhost:3111/fr/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForTimeout(3000);
  }
  console.log('Authenticated URL:', page.url());

  // 9. Mobile Admissions Console (390x844)
  if (!hasScreenshot('09-admissions-console-mobile-390-fr.png')) {
    console.log('Capturing 09-admissions-console-mobile-390-fr.png...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3111/fr/dashboard/students/admissions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const mobileAllTab = page.locator('button:has-text("Toutes")').first();
    if (await mobileAllTab.isVisible()) {
      await mobileAllTab.click({ force: true });
      await page.waitForTimeout(1200);
    }
    await saveScreenshot(page, '09-admissions-console-mobile-390-fr.png');
  }

  // 10. Mobile Detail Drawer (390x844)
  if (!hasScreenshot('10-admissions-mobile-detail-390-fr.png')) {
    console.log('Capturing 10-admissions-mobile-detail-390-fr.png...');
    const firstCard = page.locator('button:has-text("Kenza Benmoussa"), button:has-text("Mehdi Chraibi")').first();
    if (await firstCard.isVisible()) {
      await firstCard.click({ force: true });
      await page.waitForTimeout(1500);
    }
    await saveScreenshot(page, '10-admissions-mobile-detail-390-fr.png');
  }

  // 11. Arabic RTL Admissions Console (1440x1050)
  if (!hasScreenshot('11-admissions-console-desktop-ar-rtl.png')) {
    console.log('Capturing 11-admissions-console-desktop-ar-rtl.png...');
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto('http://localhost:3111/ar/dashboard/students/admissions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const arCandidate = page.locator('button:has-text("Kenza Benmoussa")').first();
    if (await arCandidate.isVisible()) {
      await arCandidate.click({ force: true });
      await page.waitForTimeout(1500);
    }
    await saveScreenshot(page, '11-admissions-console-desktop-ar-rtl.png');
  }

  // 12. Arabic RTL New Admission Wizard
  if (!hasScreenshot('12-admissions-new-wizard-ar-rtl.png')) {
    console.log('Capturing 12-admissions-new-wizard-ar-rtl.png...');
    await page.goto('http://localhost:3111/ar/dashboard/students/admissions/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveScreenshot(page, '12-admissions-new-wizard-ar-rtl.png');
  }

  await browser.close();
  console.log('Admissions Audit visual capture complete!');
}

main().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
