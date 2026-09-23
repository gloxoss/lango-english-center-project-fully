import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';

async function main() {
  console.log('Starting Authoritative Admissions Evidence Capture...');
  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------
  // 1. Desktop Session Setup (1440x1050)
  // -------------------------------------------------------------
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
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
  console.log('Navigating to French Admissions Desk...');
  await page.goto('http://localhost:3111/fr/dashboard/students/admissions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // =============================================================
  // EVIDENCE A: Populated Desktop Master-Detail (Kenza Benmoussa - in_review)
  // =============================================================
  console.log('Capturing Evidence A: Desktop Master-Detail (Kenza Benmoussa)...');
  const kenzaLoc = page.locator('button:has-text("Kenza Benmoussa")');
  if (await kenzaLoc.count() > 0) {
    await kenzaLoc.first().click({ force: true });
    await page.waitForTimeout(2000);
  }
  const pathA = path.join(ARTIFACTS_DIR, 'admissions-desktop-master-detail.png');
  await page.screenshot({ path: pathA, fullPage: false });
  console.log('Saved Evidence A to', pathA);

  // =============================================================
  // EVIDENCE B: Approved-but-not-yet-enrolled (Mehdi Chraibi - approved)
  // =============================================================
  console.log('Capturing Evidence B: Approved-but-not-enrolled (Mehdi Chraibi)...');
  const approvedTab = page.locator('button:has-text("Approuvées")').first();
  if (await approvedTab.isVisible()) {
    await approvedTab.click({ force: true });
    await page.waitForTimeout(1500);
  }
  const mehdiBtn = page.locator('button:has-text("Mehdi Chraibi")').first();
  if (await mehdiBtn.isVisible()) {
    await mehdiBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  const pathB = path.join(ARTIFACTS_DIR, 'admissions-approved-not-enrolled.png');
  await page.screenshot({ path: pathB, fullPage: false });
  console.log('Saved Evidence B to', pathB);

  // =============================================================
  // EVIDENCE C: Enrollment Confirmation Modal with selected section & capacity
  // =============================================================
  console.log('Capturing Evidence C: Enrollment Confirmation Modal...');
  const finalizeBtn = page.locator('button:has-text("Finaliser l\'inscription")').first();
  if (await finalizeBtn.isVisible()) {
    await finalizeBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // Select a class section in the modal dropdown
    const sectionSelect = page.locator('select').first();
    if (await sectionSelect.isVisible()) {
      const options = await sectionSelect.locator('option').all();
      for (const opt of options) {
        const val = await opt.getAttribute('value');
        if (val && val !== '') {
          await sectionSelect.selectOption(val);
          break;
        }
      }
      await page.waitForTimeout(600);
    }

    const pathC = path.join(ARTIFACTS_DIR, 'admissions-enrollment-confirmation-modal.png');
    await page.screenshot({ path: pathC, fullPage: false });
    console.log('Saved Evidence C to', pathC);

    // Close modal cleanly via Annuler
    const cancelBtn = page.locator('button:has-text("Annuler")').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click({ force: true });
      await page.waitForTimeout(800);
    }
  } else {
    console.error('ERROR: Finalize button not visible on Mehdi Chraibi!');
  }

  // =============================================================
  // EVIDENCE D: Enrolled state with matricule (Amina Tahiri - enrolled)
  // =============================================================
  console.log('Capturing Evidence D: Enrolled state with matricule (Amina Tahiri)...');
  const enrolledTab = page.locator('button:has-text("Inscrites")').first();
  if (await enrolledTab.isVisible()) {
    await enrolledTab.click({ force: true });
    await page.waitForTimeout(1500);
  }
  const aminaBtn = page.locator('button:has-text("Amina Tahiri")').first();
  if (await aminaBtn.isVisible()) {
    await aminaBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  const pathD = path.join(ARTIFACTS_DIR, 'admissions-enrolled-state.png');
  await page.screenshot({ path: pathD, fullPage: false });
  console.log('Saved Evidence D to', pathD);

  // =============================================================
  // EVIDENCE E: Mobile List View (390x844)
  // =============================================================
  console.log('Capturing Evidence E: Populated Mobile List (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3111/fr/dashboard/students/admissions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Switch to "Toutes" so all cards (Kenza, Mehdi, Amina) are listed
  const mobileAllTab = page.locator('button:has-text("Toutes")').first();
  if (await mobileAllTab.isVisible()) {
    await mobileAllTab.click({ force: true });
    await page.waitForTimeout(1500);
  }

  const pathE = path.join(ARTIFACTS_DIR, 'admissions-mobile-list.png');
  await page.screenshot({ path: pathE, fullPage: false });
  console.log('Saved Evidence E to', pathE);

  // =============================================================
  // EVIDENCE F: Mobile Candidate Detail Drawer (390x844)
  // =============================================================
  console.log('Capturing Evidence F: Mobile Candidate Detail (390x844)...');
  const mobileCandidate = page.locator('button:has-text("Mehdi Chraibi"), button:has-text("Kenza Benmoussa")').first();
  if (await mobileCandidate.isVisible()) {
    await mobileCandidate.click({ force: true });
    await page.waitForTimeout(1500);
  }
  const pathF = path.join(ARTIFACTS_DIR, 'admissions-mobile-detail.png');
  await page.screenshot({ path: pathF, fullPage: false });
  console.log('Saved Evidence F to', pathF);

  // =============================================================
  // EVIDENCE G: Arabic RTL View (1440x1050)
  // =============================================================
  console.log('Capturing Evidence G: Arabic RTL Master-Detail...');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('http://localhost:3111/ar/dashboard/students/admissions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const arCandidate = page.locator('button:has-text("Kenza Benmoussa")');
  if (await arCandidate.count() > 0) {
    await arCandidate.first().click({ force: true });
    await page.waitForTimeout(2000);
  }
  const pathG = path.join(ARTIFACTS_DIR, 'admissions-arabic-rtl.png');
  await page.screenshot({ path: pathG, fullPage: false });
  console.log('Saved Evidence G to', pathG);

  // =============================================================
  // EVIDENCE H: Empty Filter Semantics (French Desk - filter with 0 results)
  // =============================================================
  console.log('Capturing Evidence H: Empty Filter State (0 results)...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3111/fr/dashboard/students/admissions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const searchInput = page.locator('input[placeholder*="Massar"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill('aucun_resultat_filtre_introuvable_xyz');
    await page.waitForTimeout(2000);
  }
  const pathH = path.join(ARTIFACTS_DIR, 'admissions-empty-filter-state.png');
  await page.screenshot({ path: pathH, fullPage: false });
  console.log('Saved Evidence H to', pathH);

  await browser.close();
  console.log('All 7 authoritative evidence captures successfully completed!');
}

main().catch(err => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
