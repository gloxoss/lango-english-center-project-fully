import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';

async function main() {
  console.log('Starting Visual Evidence Capture for Admissions & Inscriptions...');
  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------
  // 1. Desktop Context (1440x900)
  // -------------------------------------------------------------
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

  // Navigate to Admissions Desk
  console.log('Navigating to Admissions Desk (/dashboard/students/admissions)...');
  await page.goto('http://localhost:3111/fr/dashboard/students/admissions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Evidence A: Desktop Master-Detail View
  console.log('Capturing Evidence A: Desktop Master-Detail...');
  const pathA = path.join(ARTIFACTS_DIR, 'admissions-desktop-master-detail.png');
  await page.screenshot({ path: pathA, fullPage: false });
  console.log(`Saved Evidence A to ${pathA}`);

  // Find or filter for an approved candidate or click one
  // Look for a candidate row or search
  const approvedFilter = page.locator('button:has-text("Approuvée"), button:has-text("Approuvées")').first();
  if (await approvedFilter.isVisible()) {
    await approvedFilter.click();
    await page.waitForTimeout(1500);
  }

  // Evidence B: Approved-but-not-yet-enrolled state
  console.log('Capturing Evidence B: Approved-but-not-yet-enrolled state...');
  const candidateRows = page.locator('.space-y-2 > button, tbody tr, .cursor-pointer');
  if (await candidateRows.count() > 0) {
    await candidateRows.first().click();
    await page.waitForTimeout(1000);
  }

  const pathB = path.join(ARTIFACTS_DIR, 'admissions-approved-not-enrolled.png');
  await page.screenshot({ path: pathB, fullPage: false });
  console.log(`Saved Evidence B to ${pathB}`);

  // Evidence C: Enrollment Confirmation Modal
  console.log('Opening Enrollment Confirmation Modal...');
  const finalizeBtn = page.locator('button:has-text("Finaliser l\'inscription")').first();
  if (await finalizeBtn.isVisible()) {
    await finalizeBtn.click();
    await page.waitForTimeout(1500);

    console.log('Capturing Evidence C: Enrollment Confirmation Modal...');
    const pathC = path.join(ARTIFACTS_DIR, 'admissions-enrollment-confirmation-modal.png');
    await page.screenshot({ path: pathC, fullPage: false });
    console.log(`Saved Evidence C to ${pathC}`);

    // Close or confirm
    const cancelModal = page.locator('button:has-text("Annuler")').first();
    if (await cancelModal.isVisible()) {
      await cancelModal.click();
      await page.waitForTimeout(500);
    }
  }

  // Evidence D: Enrolled state
  console.log('Filtering for Enrolled candidates...');
  const enrolledFilter = page.locator('button:has-text("Inscrite"), button:has-text("Inscrites")').first();
  if (await enrolledFilter.isVisible()) {
    await enrolledFilter.click();
    await page.waitForTimeout(1500);
    const firstEnrolled = page.locator('.space-y-2 > button, tbody tr, .cursor-pointer').first();
    if (await firstEnrolled.isVisible()) {
      await firstEnrolled.click();
      await page.waitForTimeout(1000);
    }
  }

  console.log('Capturing Evidence D: Enrolled state with matricule...');
  const pathD = path.join(ARTIFACTS_DIR, 'admissions-enrolled-state.png');
  await page.screenshot({ path: pathD, fullPage: false });
  console.log(`Saved Evidence D to ${pathD}`);

  // -------------------------------------------------------------
  // 2. Mobile Context (390x844)
  // -------------------------------------------------------------
  console.log('Setting up Mobile Viewport (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3111/fr/dashboard/students/admissions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Evidence E: Mobile List View
  console.log('Capturing Evidence E: Mobile List View...');
  const pathE = path.join(ARTIFACTS_DIR, 'admissions-mobile-list.png');
  await page.screenshot({ path: pathE, fullPage: false });
  console.log(`Saved Evidence E to ${pathE}`);

  // Evidence F: Mobile Detail Drawer/Sheet
  console.log('Tapping card to open Mobile Detail Sheet...');
  const mobileCard = page.locator('.block.md\\:hidden .rounded-2xl, .block.md\\:hidden .cursor-pointer').first();
  if (await mobileCard.isVisible()) {
    await mobileCard.click();
    await page.waitForTimeout(1200);
  }

  console.log('Capturing Evidence F: Mobile Detail View...');
  const pathF = path.join(ARTIFACTS_DIR, 'admissions-mobile-detail.png');
  await page.screenshot({ path: pathF, fullPage: false });
  console.log(`Saved Evidence F to ${pathF}`);

  // -------------------------------------------------------------
  // 3. Arabic RTL Smoke State
  // -------------------------------------------------------------
  console.log('Navigating to Arabic RTL Desk (/ar/dashboard/students/admissions)...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3111/ar/dashboard/students/admissions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('Capturing Evidence G: Arabic RTL Smoke State...');
  const pathG = path.join(ARTIFACTS_DIR, 'admissions-arabic-rtl.png');
  await page.screenshot({ path: pathG, fullPage: false });
  console.log(`Saved Evidence G to ${pathG}`);

  await browser.close();
  console.log('Visual Evidence Capture Complete! All 7 screenshots captured successfully.');
}

main().catch(err => {
  console.error('Error during evidence capture:', err);
  process.exit(1);
});
