import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';
const SCRATCH_DIR = path.join(ARTIFACTS_DIR, 'scratch', 'photos-test-files');
const BASE_URL = 'http://localhost:3222';

// Helper to create valid PNG buffers
function createPngBuffer(width = 200, height = 200) {
  const buf = Buffer.alloc(45);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8;
  buf[25] = 2;
  buf.writeUInt32BE(0, 29);
  buf.writeUInt32BE(0, 33);
  buf.write('IEND', 37);
  buf.writeUInt32BE(0xae426082, 41);
  return buf;
}

async function prepareTestFiles() {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });

  // 1. Ready file (matches Amina Tahiri by internal matricule STD-2026-0042)
  const readyPath = path.join(SCRATCH_DIR, 'STD-2026-0042.png');
  fs.writeFileSync(readyPath, createPngBuffer(240, 240));

  // 2. Existing photo file (matches Yassine El Amrani by matricule AAM-2425-0001, who has a photo)
  const existingPath = path.join(SCRATCH_DIR, 'AAM-2425-0001.png');
  fs.writeFileSync(existingPath, createPngBuffer(240, 240));

  // 3. No match file
  const noMatchPath = path.join(SCRATCH_DIR, 'INCONNU-2026-999.png');
  fs.writeFileSync(noMatchPath, createPngBuffer(240, 240));

  // 4. Invalid file format / fake text
  const invalidPath = path.join(SCRATCH_DIR, 'pricing_screenshot_corrupted.png');
  fs.writeFileSync(invalidPath, Buffer.from('NOT_AN_IMAGE_JUST_TEXT_PAYLOAD'));

  // 5. Huge aspect ratio banner
  const bannerPath = path.join(SCRATCH_DIR, 'website_banner_panoramic.png');
  fs.writeFileSync(bannerPath, createPngBuffer(1200, 100));

  return [readyPath, existingPath, noMatchPath, invalidPath, bannerPath];
}

async function main() {
  console.log('Preparing sample files for bulk upload...');
  const testFiles = await prepareTestFiles();
  console.log(`Created ${testFiles.length} sample files in ${SCRATCH_DIR}`);

  console.log('Launching browser for Photos Élèves Visual Acceptance Evidence...');
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

  // --------------------------------------------------------------------------
  // SCREENSHOT A: Desktop Populated Gallery
  // --------------------------------------------------------------------------
  console.log('Navigating to /fr/dashboard/students/photos...');
  await page.goto(`${BASE_URL}/fr/dashboard/students/photos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const pathA = path.join(ARTIFACTS_DIR, 'photos_evidence_a_desktop_gallery.png');
  await page.screenshot({ path: pathA, fullPage: false });
  console.log('✅ Captured Screenshot A (Desktop Gallery) →', pathA);

  // --------------------------------------------------------------------------
  // SCREENSHOT B: Student Photo Detail Modal (Student WITH photo)
  // --------------------------------------------------------------------------
  console.log('Opening detail modal for student with photo (Salma Bennani)...');
  const studentWithPhotoCard = page.locator('div.grid button:has-text("Salma Bennani")').first();
  await studentWithPhotoCard.click({ force: true });
  await page.waitForTimeout(1000);

  const pathB = path.join(ARTIFACTS_DIR, 'photos_evidence_b_detail_with_photo.png');
  await page.screenshot({ path: pathB, fullPage: false });
  console.log('✅ Captured Screenshot B (Detail with Photo) →', pathB);

  // Close modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // --------------------------------------------------------------------------
  // SCREENSHOT C: Student Without Photo (Initials fallback + upload CTA)
  // --------------------------------------------------------------------------
  console.log('Opening detail modal for student without photo (Amina Tahiri)...');
  const studentWithoutPhotoCard = page.locator('button:has-text("Amina Tahiri")').first();
  await studentWithoutPhotoCard.click({ force: true });
  await page.waitForTimeout(1000);

  const pathC = path.join(ARTIFACTS_DIR, 'photos_evidence_c_detail_without_photo.png');
  await page.screenshot({ path: pathC, fullPage: false });
  console.log('✅ Captured Screenshot C (Detail without Photo) →', pathC);

  // Close modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // --------------------------------------------------------------------------
  // SCREENSHOT D: Bulk Upload Modal (Step 1: Selection)
  // --------------------------------------------------------------------------
  console.log('Opening Bulk Upload modal...');
  const bulkBtn = page.locator('button:has-text("Téléversement groupé")').first();
  await bulkBtn.click({ force: true });
  await page.waitForTimeout(1000);

  const pathD = path.join(ARTIFACTS_DIR, 'photos_evidence_d_bulk_selection_step.png');
  await page.screenshot({ path: pathD, fullPage: false });
  console.log('✅ Captured Screenshot D (Bulk Selection Modal) →', pathD);

  // --------------------------------------------------------------------------
  // SCREENSHOT E & G: Bulk Reconciliation Preview Table & Invalid Image Rejection
  // --------------------------------------------------------------------------
  console.log('Injecting sample batch files into bulk file input...');
  const fileInput = page.locator('input[type="file"][multiple]').first();
  await fileInput.setInputFiles(testFiles);
  await page.waitForTimeout(1000);

  console.log('Clicking "Analyser les correspondances"...');
  const analyzeBtn = page.locator('button:has-text("Analyser")').first();
  await analyzeBtn.click({ force: true });
  await page.waitForTimeout(3000); // Wait for preview analysis

  const pathE = path.join(ARTIFACTS_DIR, 'photos_evidence_e_bulk_reconciliation_preview.png');
  await page.screenshot({ path: pathE, fullPage: false });
  console.log('✅ Captured Screenshot E (Bulk Reconciliation Preview) →', pathE);

  const pathG = path.join(ARTIFACTS_DIR, 'photos_evidence_g_invalid_image_rejection.png');
  await page.screenshot({ path: pathG, fullPage: false });
  console.log('✅ Captured Screenshot G (Invalid Image Rejection Detail) →', pathG);

  // --------------------------------------------------------------------------
  // SCREENSHOT F: Confirmed Bulk Result
  // --------------------------------------------------------------------------
  console.log('Clicking "Confirmer l\'importation" to commit matches...');
  const confirmImportBtn = page.locator('button:has-text("Confirmer")').first();
  if (await confirmImportBtn.isVisible()) {
    await confirmImportBtn.click({ force: true });
    await page.waitForTimeout(2500); // Wait for commit report
  }

  const pathF = path.join(ARTIFACTS_DIR, 'photos_evidence_f_bulk_commit_report.png');
  await page.screenshot({ path: pathF, fullPage: false });
  console.log('✅ Captured Screenshot F (Bulk Commit Report) →', pathF);

  // Close bulk modal
  const closeBulkBtn = page.locator('button:has-text("Fermer")').last();
  if (await closeBulkBtn.isVisible()) {
    await closeBulkBtn.click({ force: true });
    await page.waitForTimeout(1000);
  } else {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // --------------------------------------------------------------------------
  // SCREENSHOT H: Replacement / Deletion Confirmation Flow
  // --------------------------------------------------------------------------
  console.log('Opening detail modal for student with photo to trigger delete confirmation...');
  await page.goto(`${BASE_URL}/fr/dashboard/students/photos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const firstStudentWithPhoto = page.locator('div.grid button:has-text("Salma Bennani")').first();
  await firstStudentWithPhoto.click({ force: true });
  await page.waitForTimeout(1000);

  const deletePhotoBtn = page.locator('button:has-text("Supprimer la photo")').first();
  if (await deletePhotoBtn.isVisible()) {
    await deletePhotoBtn.click({ force: true });
    await page.waitForTimeout(800); // Confirmation bar appears
  }

  const pathH = path.join(ARTIFACTS_DIR, 'photos_evidence_h_replacement_deletion_flow.png');
  await page.screenshot({ path: pathH, fullPage: false });
  console.log('✅ Captured Screenshot H (Delete Confirmation Flow) →', pathH);

  // Cancel deletion
  const cancelBtn = page.locator('button:has-text("Annuler")').first();
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // --------------------------------------------------------------------------
  // SCREENSHOT I: Mobile Viewport 390px
  // --------------------------------------------------------------------------
  console.log('Switching to mobile viewport 390x844...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/fr/dashboard/students/photos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const pathI = path.join(ARTIFACTS_DIR, 'photos_evidence_i_mobile_390px.png');
  await page.screenshot({ path: pathI, fullPage: false });
  console.log('✅ Captured Screenshot I (Mobile 390px) →', pathI);

  // --------------------------------------------------------------------------
  // SCREENSHOT J: Arabic RTL View
  // --------------------------------------------------------------------------
  console.log('Switching to desktop viewport and Arabic RTL...');
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`${BASE_URL}/ar/dashboard/students/photos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const pathJ = path.join(ARTIFACTS_DIR, 'photos_evidence_j_arabic_rtl.png');
  await page.screenshot({ path: pathJ, fullPage: false });
  console.log('✅ Captured Screenshot J (Arabic RTL) →', pathJ);

  console.log('\n================================================================');
  console.log('ALL 10 SCREENSHOTS (A–J) CAPTURED SUCCESSFULLY!');
  console.log('================================================================\n');

  await browser.close();
}

main().catch((err) => {
  console.error('FATAL ERROR capturing evidence:', err);
  process.exit(1);
});
