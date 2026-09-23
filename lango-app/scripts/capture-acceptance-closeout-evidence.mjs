import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';

async function main() {
  console.log('Capturing Final Acceptance Closeout Evidence...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  console.log('Logging in...');
  await page.goto('http://localhost:3111/fr/login', { waitUntil: 'networkidle' });

  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  // 1. Student Directory (Showing "À confirmer" badge on legacy guardian)
  console.log('Navigating to Student Directory...');
  await page.goto('http://localhost:3111/fr/dashboard/students', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const dirPath = path.join(ARTIFACTS_DIR, 'student-directory-after.png');
  await page.screenshot({ path: dirPath, fullPage: false });
  console.log(`Saved Directory After: ${dirPath}`);

  // 2. Student 360 Profile
  console.log('Navigating to Student 360 (STU-001)...');
  await page.goto('http://localhost:3111/fr/dashboard/students/STU-001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const profilePath = path.join(ARTIFACTS_DIR, 'student-360-profile-after.png');
  await page.screenshot({ path: profilePath, fullPage: false });
  console.log(`Saved Profile After: ${profilePath}`);

  // 3. Student 360 Guardians
  console.log('Capturing Guardians Tab...');
  const guardiansTab = page.locator('div.bg-slate-100 button').filter({ hasText: 'Tuteurs' }).first();
  await guardiansTab.click({ force: true });
  await page.waitForTimeout(600);
  const guardiansPath = path.join(ARTIFACTS_DIR, 'student-360-guardians-after.png');
  await page.screenshot({ path: guardiansPath, fullPage: false });
  console.log(`Saved Guardians After: ${guardiansPath}`);

  // 4. Student 360 Academic (Showing "Taux sur pointages enregistrés" and "1 présent / 1 pointage enregistré")
  console.log('Capturing Academic Tab...');
  const academicTab = page.locator('div.bg-slate-100 button').filter({ hasText: 'Académique' }).first();
  await academicTab.click({ force: true });
  await page.waitForTimeout(600);
  const academicPath = path.join(ARTIFACTS_DIR, 'student-360-academic-after.png');
  await page.screenshot({ path: academicPath, fullPage: false });
  console.log(`Saved Academic After: ${academicPath}`);

  // 5. Student 360 Finance (Showing dynamic session year)
  console.log('Capturing Finance Tab...');
  const financeTab = page.locator('div.bg-slate-100 button').filter({ hasText: 'Finance' }).first();
  await financeTab.click({ force: true });
  await page.waitForTimeout(600);
  const financePath = path.join(ARTIFACTS_DIR, 'student-360-finance-after.png');
  await page.screenshot({ path: financePath, fullPage: false });
  console.log(`Saved Finance After: ${financePath}`);

  await browser.close();
  console.log('All acceptance evidence captured successfully.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
