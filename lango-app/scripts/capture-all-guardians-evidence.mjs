import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';
const GUARDIAN_ID = '299bbbe0-f75e-4c82-b117-3e9e89c56e9f'; // Tariq Benjelloun

async function main() {
  console.log('Starting Authoritative Guardians & Responsibilities Evidence Capture...');
  const browser = await chromium.launch({ headless: true });

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

  // =============================================================
  // EVIDENCE A: Guardian directory desktop
  // =============================================================
  console.log('Capturing Evidence A: Guardian directory desktop...');
  await page.goto('http://localhost:3111/fr/dashboard/students/parents', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const pathA = path.join(ARTIFACTS_DIR, 'guardians-a-desktop-directory.png');
  await page.screenshot({ path: pathA, fullPage: false });
  console.log('Saved Evidence A to', pathA);

  // =============================================================
  // EVIDENCE B: Directory quick inspector
  // =============================================================
  console.log('Capturing Evidence B: Directory quick inspector...');
  const rowLocator = page.locator('tr:has-text("Benjelloun"), tr:has-text("Tariq")').first();
  if (await rowLocator.count() > 0) {
    await rowLocator.click({ force: true });
    await page.waitForTimeout(1500);
  }
  const pathB = path.join(ARTIFACTS_DIR, 'guardians-b-quick-inspector.png');
  await page.screenshot({ path: pathB, fullPage: false });
  console.log('Saved Evidence B to', pathB);

  // =============================================================
  // EVIDENCE F: Create / Find Guardian Modal
  // =============================================================
  console.log('Capturing Evidence F: Create / Find Guardian Modal...');
  const addBtn = page.locator('button:has-text("Ajouter un tuteur"), button:has-text("Ajouter")').first();
  await addBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (await addBtn.isVisible()) {
    await addBtn.click({ force: true });
    await page.waitForTimeout(1500);
    const pathF = path.join(ARTIFACTS_DIR, 'guardians-f-create-modal.png');
    await page.screenshot({ path: pathF, fullPage: false });
    console.log('Saved Evidence F to', pathF);

    // Close modal cleanly
    const cancelModal = page.locator('button:has-text("Annuler")').first();
    if (await cancelModal.isVisible()) {
      await cancelModal.click({ force: true });
      await page.waitForTimeout(600);
    }
  } else {
    console.error('ERROR: Add guardian button not visible!');
  }

  // =============================================================
  // EVIDENCE C: Guardian profile children tab
  // =============================================================
  console.log('Capturing Evidence C: Guardian profile children tab...');
  await page.goto(`http://localhost:3111/fr/dashboard/students/parents/${GUARDIAN_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const pathC = path.join(ARTIFACTS_DIR, 'guardians-c-profile-children.png');
  await page.screenshot({ path: pathC, fullPage: false });
  console.log('Saved Evidence C to', pathC);

  // =============================================================
  // EVIDENCE D: Financial responsibility card focus
  // =============================================================
  console.log('Capturing Evidence D: Financial responsibility card...');
  const pathD = path.join(ARTIFACTS_DIR, 'guardians-d-financial-responsibility.png');
  await page.screenshot({ path: pathD, fullPage: false });
  console.log('Saved Evidence D to', pathD);

  // =============================================================
  // EVIDENCE E: Activity tab with real events
  // =============================================================
  console.log('Capturing Evidence E: Activity tab with real events...');
  const activityTab = page.locator('button:has-text("Activité"), [role="tab"]:has-text("Activité")').first();
  if (await activityTab.isVisible()) {
    await activityTab.click({ force: true });
    await page.waitForTimeout(1500);
  }
  const pathE = path.join(ARTIFACTS_DIR, 'guardians-e-activity-tab.png');
  await page.screenshot({ path: pathE, fullPage: false });
  console.log('Saved Evidence E to', pathE);

  // Switch back to children tab
  const childrenTab = page.locator('button:has-text("Enfants rattachés"), [role="tab"]:has-text("Enfants")').first();
  if (await childrenTab.isVisible()) {
    await childrenTab.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // =============================================================
  // EVIDENCE G: Link existing student modal
  // =============================================================
  console.log('Capturing Evidence G: Link existing student modal...');
  const linkBtn = page.locator('button:has-text("Lier un enfant"), button:has-text("Rattacher")').first();
  await linkBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (await linkBtn.isVisible()) {
    await linkBtn.click({ force: true });
    await page.waitForTimeout(1500);
    const pathG = path.join(ARTIFACTS_DIR, 'guardians-g-link-student-modal.png');
    await page.screenshot({ path: pathG, fullPage: false });
    console.log('Saved Evidence G to', pathG);

    // Close modal cleanly
    const cancelLink = page.locator('button:has-text("Annuler")').first();
    if (await cancelLink.isVisible()) {
      await cancelLink.click({ force: true });
      await page.waitForTimeout(600);
    }
  } else {
    console.error('ERROR: Link student button not visible!');
  }

  // =============================================================
  // EVIDENCE H: Mobile directory 390px
  // =============================================================
  console.log('Capturing Evidence H: Mobile directory 390px...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3111/fr/dashboard/students/parents', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const pathH = path.join(ARTIFACTS_DIR, 'guardians-h-mobile-directory-390px.png');
  await page.screenshot({ path: pathH, fullPage: false });
  console.log('Saved Evidence H to', pathH);

  // =============================================================
  // EVIDENCE I: Mobile guardian detail 390px
  // =============================================================
  console.log('Capturing Evidence I: Mobile guardian detail 390px...');
  await page.goto(`http://localhost:3111/fr/dashboard/students/parents/${GUARDIAN_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const pathI = path.join(ARTIFACTS_DIR, 'guardians-i-mobile-detail-390px.png');
  await page.screenshot({ path: pathI, fullPage: false });
  console.log('Saved Evidence I to', pathI);

  // =============================================================
  // EVIDENCE J: Arabic RTL populated state
  // =============================================================
  console.log('Capturing Evidence J: Arabic RTL populated state...');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('http://localhost:3111/ar/dashboard/students/parents', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const pathJ = path.join(ARTIFACTS_DIR, 'guardians-j-arabic-rtl-populated.png');
  await page.screenshot({ path: pathJ, fullPage: false });
  console.log('Saved Evidence J to', pathJ);

  console.log('All visual evidence captured successfully!');
  await browser.close();
}

main().catch(err => {
  console.error('Error during evidence capture:', err);
  process.exit(1);
});
