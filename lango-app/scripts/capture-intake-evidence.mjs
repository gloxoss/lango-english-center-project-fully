import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';
const BASE_URL = 'http://localhost:3222';

async function main() {
  console.log('Launching browser for Admissions Intake Evidence...');
  const browser = await chromium.launch({ headless: true });
  
  // 1. Desktop Context
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  console.log('Logging in as School Admin...');
  await page.goto(`${BASE_URL}/fr/login`, { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  // 1. Desktop FR - Step 1 Initial with Disclaimer Banner, Campus, Academic Year, Code Massar
  console.log('Capturing Evidence 1: Desktop FR (Step 1)...');
  await page.goto(`${BASE_URL}/fr/dashboard/students/add`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const path1 = path.join(ARTIFACTS_DIR, 'intake-1-desktop-fr.png');
  await page.screenshot({ path: path1, fullPage: false });
  console.log('Saved Evidence 1 to', path1);

  // 2. Mobile FR - Step 1 Responsive 390px
  console.log('Capturing Evidence 2: Mobile FR (390x844)...');
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  // Copy cookies from logged in context
  const cookies = await context.cookies();
  await mobileContext.addCookies(cookies);
  await mobilePage.goto(`${BASE_URL}/fr/dashboard/students/add`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);
  const path2 = path.join(ARTIFACTS_DIR, 'intake-2-mobile-fr.png');
  await mobilePage.screenshot({ path: path2, fullPage: false });
  console.log('Saved Evidence 2 to', path2);
  await mobileContext.close();

  // 3. Desktop Arabic RTL - Step 1
  console.log('Capturing Evidence 3: Arabic RTL (Step 1)...');
  await page.goto(`${BASE_URL}/ar/dashboard/students/add`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const path3 = path.join(ARTIFACTS_DIR, 'intake-3-arabic-rtl.png');
  await page.screenshot({ path: path3, fullPage: false });
  console.log('Saved Evidence 3 to', path3);

  // Switch back to FR for Wizard Steps 2, 3, 4
  console.log('Navigating back to French intake to demonstrate workflow steps...');
  await page.goto(`${BASE_URL}/fr/dashboard/students/add`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Fill Step 1 with a candidate
  const timestamp = Date.now().toString().slice(-4);
  await page.fill('#admission-first-name', 'Amine');
  await page.fill('#admission-last-name', 'El Fassi');
  await page.fill('#admission-email', `amine.fassi.${timestamp}@test.atlas.ma`);
  await page.fill('#admission-phone', '+212 6 12 34 56 78');
  await page.fill('#admission-dob', '2012-05-14');
  await page.selectOption('#admission-gender', 'male');
  
  // Select branch and academic year if available
  const branchSelect = page.locator('#admission-branch');
  const branchOptions = await branchSelect.locator('option').all();
  if (branchOptions.length > 1) {
    const val = await branchOptions[1].getAttribute('value');
    if (val) await branchSelect.selectOption(val);
  }

  const yearSelect = page.locator('#admission-year');
  const yearOptions = await yearSelect.locator('option').all();
  if (yearOptions.length > 1) {
    const val = await yearOptions[1].getAttribute('value');
    if (val) await yearSelect.selectOption(val);
  }

  await page.fill('#admission-massar', 'K139284751');
  await page.fill('#admission-city', 'Fès');
  await page.waitForTimeout(500);

  // Click Suivant -> Step 2
  console.log('Advancing to Step 2 (Guardian)...');
  const nextBtn = page.locator('button:has-text("Suivant")').last();
  await nextBtn.click();
  await page.waitForTimeout(2000);

  // Search existing guardian (e.g. "Benjelloun" or "Tariq") to show guardian reuse search-first
  console.log('Searching existing guardian...');
  await page.fill('#admission-guardian-search', 'Benjelloun');
  await page.waitForTimeout(1500);

  const path4 = path.join(ARTIFACTS_DIR, 'intake-4-guardian-step.png');
  await page.screenshot({ path: path4, fullPage: false });
  console.log('Saved Evidence 4 to', path4);

  // Select the guardian if found, or click to create new guardian
  const selectGuardianBtn = page.locator('button:has-text("Sélectionner ce tuteur")').first();
  if (await selectGuardianBtn.isVisible()) {
    await selectGuardianBtn.click();
    await page.waitForTimeout(500);
  } else {
    const createGuardianBtn = page.locator('button:has-text("Nouveau responsable"), button:has-text("Créer")').first();
    if (await createGuardianBtn.isVisible()) {
      await createGuardianBtn.click();
      await page.waitForTimeout(500);
      await page.fill('#admission-guardian-name', 'Omar El Fassi');
      await page.fill('#admission-guardian-phone', '+212 6 98 76 54 32');
    }
  }

  // Advance to Step 3 (Documents)
  console.log('Advancing to Step 3 (Documents & Consents)...');
  const step3Btn = page.locator('button:has-text("Suivant")').last();
  await step3Btn.click();
  await page.waitForTimeout(1500);

  const path5 = path.join(ARTIFACTS_DIR, 'intake-5-documents-step.png');
  await page.screenshot({ path: path5, fullPage: false });
  console.log('Saved Evidence 5 to', path5);

  // Advance to Step 4 (Validation)
  console.log('Advancing to Step 4 (Validation & Soumission)...');
  const step4Btn = page.locator('button:has-text("Suivant")').last();
  await step4Btn.click();
  await page.waitForTimeout(1500);

  const path6 = path.join(ARTIFACTS_DIR, 'intake-6-validation-step.png');
  await page.screenshot({ path: path6, fullPage: false });
  console.log('Saved Evidence 6 to', path6);

  // Click Submit / Finalize
  console.log('Finalizing admission request...');
  const finalizeBtn = page.locator('button:has-text("Finaliser la demande")').first();
  if (await finalizeBtn.isVisible()) {
    await finalizeBtn.click();
    await page.waitForTimeout(3000);
    const path7 = path.join(ARTIFACTS_DIR, 'intake-7-success-submitted.png');
    await page.screenshot({ path: path7, fullPage: false });
    console.log('Saved Evidence 7 to', path7);
  }

  console.log('All evidence captured successfully!');
  await browser.close();
}

main().catch(err => {
  console.error('Error during evidence capture:', err);
  process.exit(1);
});
