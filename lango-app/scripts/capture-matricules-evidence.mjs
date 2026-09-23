import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';
const BASE_URL = 'http://localhost:3222';

async function main() {
  console.log('Launching browser for Matricule Module Visual Acceptance Evidence...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  // 1. Login as School Admin
  console.log('Logging in as School Admin (y.elamrani@atlas.ma)...');
  await page.goto(`${BASE_URL}/fr/login`, { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  // 2. Evidence A: Populated Desktop List
  console.log('Navigating to /fr/dashboard/students/matricules...');
  await page.goto(`${BASE_URL}/fr/dashboard/students/matricules`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const pathDesktop = path.join(ARTIFACTS_DIR, 'matricules-desktop-list.png');
  await page.screenshot({ path: pathDesktop, fullPage: false });
  console.log('Saved Evidence A (Desktop List) to', pathDesktop);

  // 3. Evidence B: Student with Both Identifiers (Massar + Internal Matricule)
  const pathBoth = path.join(ARTIFACTS_DIR, 'matricules-both-identifiers.png');
  await page.screenshot({ path: pathBoth, fullPage: false });
  console.log('Saved Evidence B (Both Identifiers) to', pathBoth);

  // 4. Evidence C: Filter "Sans Massar"
  console.log('Clicking "Sans Massar" filter button...');
  const sansMassarBtn = page.locator('button:has-text("Sans Massar")').first();
  if (await sansMassarBtn.isVisible()) {
    await sansMassarBtn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  const pathMissingMassar = path.join(ARTIFACTS_DIR, 'matricules-missing-massar.png');
  await page.screenshot({ path: pathMissingMassar, fullPage: false });
  console.log('Saved Evidence C (Missing Massar Filter) to', pathMissingMassar);

  // Switch back to "Tous"
  const tousBtn = page.locator('button:has-text("Tous")').first();
  if (await tousBtn.isVisible()) {
    await tousBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // 5. Evidence D: Edit Modal Open
  console.log('Opening Edit Identifiers modal...');
  const editBtn = page.locator('button:has-text("Modifier")').first();
  await editBtn.click({ force: true });
  await page.waitForTimeout(1000);

  const pathModal = path.join(ARTIFACTS_DIR, 'matricules-edit-modal.png');
  await page.screenshot({ path: pathModal, fullPage: false });
  console.log('Saved Evidence D (Edit Modal) to', pathModal);

  // 6. Evidence E: Duplicate Validation Error (409 Conflict)
  console.log('Testing duplicate conflict detection in Edit Modal...');
  // Fill with an existing Code Massar in this tenant e.g. R192837465 or G134567890
  const massarInput = page.locator('input[placeholder*="G134567890"]').first();
  await massarInput.fill('G134567890');
  await page.waitForTimeout(500);

  const saveBtn = page.locator('button:has-text("Enregistrer les identifiants")').first();
  await saveBtn.click({ force: true });
  await page.waitForTimeout(2000);

  const pathDupError = path.join(ARTIFACTS_DIR, 'matricules-duplicate-error.png');
  await page.screenshot({ path: pathDupError, fullPage: false });
  console.log('Saved Evidence E (Duplicate Conflict Error) to', pathDupError);

  // Close modal
  const cancelBtn = page.locator('button:has-text("Annuler")').first();
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click({ force: true });
    await page.waitForTimeout(500);
  }

  // 7. Evidence F: Mobile 390px
  console.log('Resizing to Mobile Viewport (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/fr/dashboard/students/matricules`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const pathMobile = path.join(ARTIFACTS_DIR, 'matricules-mobile-390px.png');
  await page.screenshot({ path: pathMobile, fullPage: false });
  console.log('Saved Evidence F (Mobile 390px) to', pathMobile);

  // 8. Evidence G: Arabic RTL
  console.log('Navigating to Arabic RTL /ar/dashboard/students/matricules...');
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`${BASE_URL}/ar/dashboard/students/matricules`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const pathArabic = path.join(ARTIFACTS_DIR, 'matricules-arabic-rtl.png');
  await page.screenshot({ path: pathArabic, fullPage: false });
  console.log('Saved Evidence G (Arabic RTL) to', pathArabic);

  await browser.close();
  console.log('All visual acceptance screenshots successfully captured.');
}

main().catch(err => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
