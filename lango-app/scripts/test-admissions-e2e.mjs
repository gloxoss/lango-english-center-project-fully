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

  console.log('Navigating to New Admission (/dashboard/students/admissions/new)...');
  await page.goto('http://localhost:3111/fr/dashboard/students/admissions/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Step 1: Fill student info
  console.log('Filling Step 1 (Student Info)...');
  await page.fill('#admission-first-name', 'Amine');
  await page.fill('#admission-last-name', 'Tazi');
  await page.fill('#admission-email', `amine.tazi.${Date.now()}@example.com`);
  await page.fill('#admission-phone', '+212612345678');
  await page.fill('#admission-city', 'Casablanca');
  await page.fill('#admission-nationality', 'Marocaine');

  // Select gender and mother tongue
  const genderSelect = page.locator('#admission-gender');
  if (await genderSelect.count() > 0) {
    await genderSelect.selectOption('male');
  }

  const langSelect = page.locator('#admission-mother-tongue');
  if (await langSelect.count() > 0) {
    await langSelect.selectOption('arabic');
  }

  // Click Next
  console.log('Clicking Suivant to Step 2...');
  await page.click('button:has-text("Suivant")');
  await page.waitForTimeout(2000);

  const step2Path = path.join(ARTIFACTS_DIR, 'admissions-wizard-step2.png');
  await page.screenshot({ path: step2Path, fullPage: false });
  console.log(`Saved Step 2: ${step2Path}`);

  // In Step 2, search or create guardian
  console.log('Filling Guardian Form in Step 2...');
  await page.fill('#admission-guardian-search', 'Karim');
  await page.waitForTimeout(1000);

  const createPrompt = page.locator('button:has-text("Créer un nouveau tuteur"), button:has-text("créer")');
  if (await createPrompt.count() > 0) {
    await createPrompt.first().click();
    await page.waitForTimeout(500);
    await page.fill('#admission-guardian-name', 'Karim Tazi');
    await page.fill('#admission-guardian-phone', '+212698765432');
    await page.fill('#admission-guardian-email', 'karim.tazi@example.com');
  }

  // Click Next to Step 3
  console.log('Clicking Suivant to Step 3...');
  await page.click('button:has-text("Suivant")');
  await page.waitForTimeout(1500);

  const step3Path = path.join(ARTIFACTS_DIR, 'admissions-wizard-step3.png');
  await page.screenshot({ path: step3Path, fullPage: false });
  console.log(`Saved Step 3: ${step3Path}`);

  // Click Next to Step 4
  console.log('Clicking Suivant to Step 4...');
  await page.click('button:has-text("Suivant")');
  await page.waitForTimeout(1500);

  const step4Path = path.join(ARTIFACTS_DIR, 'admissions-wizard-step4.png');
  await page.screenshot({ path: step4Path, fullPage: false });
  console.log(`Saved Step 4: ${step4Path}`);

  // Submit
  console.log('Submitting Dossier in Step 4...');
  const submitBtn = page.locator('button:has-text("Finaliser la demande"), button:has-text("Confirmer")');
  if (await submitBtn.count() > 0) {
    await submitBtn.first().click();
    await page.waitForTimeout(3000);
  }

  // Navigate to /dashboard/students/admissions to see the candidate in the list!
  console.log('Navigating to Admissions Desk...');
  await page.goto('http://localhost:3111/fr/dashboard/students/admissions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const deskPath = path.join(ARTIFACTS_DIR, 'admissions-desk-with-candidate.png');
  await page.screenshot({ path: deskPath, fullPage: false });
  console.log(`Saved Admissions Desk with Candidate: ${deskPath}`);

  await browser.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
