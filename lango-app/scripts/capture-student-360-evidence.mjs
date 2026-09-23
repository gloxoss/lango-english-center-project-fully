import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';

async function main() {
  console.log('Starting Student 360 Visual Evidence Capture...');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop context
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();

  // Login
  console.log('Logging in as School Admin...');
  await page.goto('http://localhost:3111/fr/login', { waitUntil: 'networkidle' });

  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  // Navigate to Student 360 for Yassine
  console.log('Navigating to Student 360 (STU-001)...');
  await page.goto('http://localhost:3111/fr/dashboard/students/STU-001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // A. Desktop Profile
  console.log('Capturing Desktop Profile...');
  const profilePath = path.join(ARTIFACTS_DIR, 'student-360-desktop-profile.png');
  await page.screenshot({ path: profilePath, fullPage: false });
  console.log(`Saved: ${profilePath}`);

  // B. Desktop Guardians
  console.log('Capturing Desktop Guardians...');
  const guardiansTab = page.locator('div.bg-slate-100 button').filter({ hasText: 'Tuteurs' }).first();
  await guardiansTab.click({ force: true });
  await page.waitForTimeout(600);
  const guardiansPath = path.join(ARTIFACTS_DIR, 'student-360-desktop-guardians.png');
  await page.screenshot({ path: guardiansPath, fullPage: false });
  console.log(`Saved: ${guardiansPath}`);

  // C. Desktop Academic
  console.log('Capturing Desktop Academic...');
  const academicTab = page.locator('div.bg-slate-100 button').filter({ hasText: 'Académique' }).first();
  await academicTab.click({ force: true });
  await page.waitForTimeout(600);
  const academicPath = path.join(ARTIFACTS_DIR, 'student-360-desktop-academic.png');
  await page.screenshot({ path: academicPath, fullPage: false });
  console.log(`Saved: ${academicPath}`);

  // D. Desktop Finance
  console.log('Capturing Desktop Finance...');
  const financeTab = page.locator('div.bg-slate-100 button').filter({ hasText: 'Finance' }).first();
  await financeTab.click({ force: true });
  await page.waitForTimeout(600);
  const financePath = path.join(ARTIFACTS_DIR, 'student-360-desktop-finance.png');
  await page.screenshot({ path: financePath, fullPage: false });
  console.log(`Saved: ${financePath}`);

  // 2. Mobile Context (390 x 844)
  console.log('Setting up Mobile Context (390x844)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
  });
  const mobilePage = await mobileContext.newPage();

  // Mobile login / reuse cookies
  const cookies = await desktopContext.cookies();
  await mobileContext.addCookies(cookies);

  // E. Mobile Profile
  console.log('Capturing Mobile Profile...');
  await mobilePage.goto('http://localhost:3111/fr/dashboard/students/STU-001', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);
  const mobileProfilePath = path.join(ARTIFACTS_DIR, 'student-360-mobile-profile.png');
  await mobilePage.screenshot({ path: mobileProfilePath, fullPage: false });
  console.log(`Saved: ${mobileProfilePath}`);

  // F. Mobile Finance
  console.log('Capturing Mobile Finance...');
  const mobileFinanceTab = mobilePage.locator('div.bg-slate-100 button').filter({ hasText: 'Finance' }).first();
  await mobileFinanceTab.scrollIntoViewIfNeeded();
  await mobileFinanceTab.click({ force: true });
  await mobilePage.waitForTimeout(800);
  const mobileFinancePath = path.join(ARTIFACTS_DIR, 'student-360-mobile-finance.png');
  await mobilePage.screenshot({ path: mobileFinancePath, fullPage: false });
  console.log(`Saved: ${mobileFinancePath}`);

  // G. Arabic RTL Smoke State (1440x900)
  console.log('Capturing Arabic RTL Smoke State...');
  await page.goto('http://localhost:3111/ar/dashboard/students/STU-001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const rtlPath = path.join(ARTIFACTS_DIR, 'student-360-arabic-rtl.png');
  await page.screenshot({ path: rtlPath, fullPage: false });
  console.log(`Saved: ${rtlPath}`);

  await browser.close();
  console.log('All 7 screenshots captured successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
