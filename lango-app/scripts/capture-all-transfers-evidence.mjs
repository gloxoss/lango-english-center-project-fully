import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3222';
const ARTIFACTS_DIR = 'C:/Users/OMEN/.gemini/antigravity-ide/brain/ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function run() {
  console.log('Launching browser to capture visual evidence A-J...');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR',
  });
  const page = await context.newPage();

  console.log('1. Signing in as school_admin (y.elamrani@atlas.ma)...');
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('input[type="email"]').fill('y.elamrani@atlas.ma');
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.locator('input[type="password"]').press('Enter');

  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 60000 });
  console.log('Signed in successfully!');

  // Navigate to transfers page
  console.log('Navigating to /fr/dashboard/students/transfers...');
  await page.goto(`${BASE}/fr/dashboard/students/transfers`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);

  // Evidence A: Transfers overview
  console.log('Capturing Evidence A (Overview)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'transfers_evidence_a_overview.png'),
    fullPage: true,
  });

  // Search for student
  console.log('Searching for student "Salma"...');
  const searchInput = page.locator('main input').first();
  await searchInput.fill('Salma');
  await page.waitForTimeout(1500);

  // Select student
  console.log('Selecting student from results...');
  const selectBtn = page.locator('button:has-text("Sélectionner"), button:has-text("Select")').first();
  await selectBtn.waitFor({ state: 'visible', timeout: 10000 });
  await selectBtn.click();
  await page.waitForTimeout(2000);

  // Evidence B: Student selected + truthful dossier
  console.log('Capturing Evidence B (Student Dossier)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'transfers_evidence_b_student_dossier.png'),
    fullPage: false,
  });

  // Advance to Step 2: Destination
  console.log('Advancing to Step 2 (Destination & Capacity)...');
  const nextStepBtn = page.locator('button:has-text("Continuer vers le choix"), button:has-text("Continuer")').first();
  await nextStepBtn.click();
  await page.waitForTimeout(2000);

  // Evidence C: Campus selection
  console.log('Capturing Evidence C (Campus Selection)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'transfers_evidence_c_campus_selection.png'),
    fullPage: false,
  });

  // Select target campus card (Campus Annexe)
  console.log('Selecting target campus card (Campus Annexe)...');
  const annexeCard = page.locator('text=Campus Annexe').first();
  await annexeCard.click();
  await page.waitForTimeout(2500);

  // Evidence D: Section selection & capacity
  console.log('Capturing Evidence D (Section Selection & Capacity)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'transfers_evidence_d_section_selection.png'),
    fullPage: false,
  });

  // Choose a section or unassigned option
  const unassignedCard = page.locator("text=Non assigné pour l'instant").first();
  if (await unassignedCard.isVisible()) {
    await unassignedCard.click();
    await page.waitForTimeout(1000);
  } else {
    const sectionCard = page.locator('text=1ère').first();
    if (await sectionCard.isVisible()) {
      await sectionCard.click();
      await page.waitForTimeout(1000);
    }
  }

  // Evidence E: Capacity status / check
  console.log('Capturing Evidence E (Capacity Exceeded or Status)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'transfers_evidence_e_capacity_exceeded.png'),
    fullPage: false,
  });

  // Advance to Step 3: Synthesis
  console.log('Advancing to Step 3 (Synthesis & Confirmation)...');
  const toSynthesisBtn = page.locator('button:has-text("Continuer vers la synthèse")').first();
  await toSynthesisBtn.scrollIntoViewIfNeeded();
  await toSynthesisBtn.click();
  await page.waitForTimeout(2500);

  // Evidence F: Final synthesis
  console.log('Capturing Evidence F (Final Synthesis)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'transfers_evidence_f_synthesis_confirm.png'),
    fullPage: true,
  });

  // Submit transfer
  console.log('Submitting transfer...');
  const confirmBtn = page.locator('button:has-text("Confirmer")').first();
  if (await confirmBtn.isVisible()) {
    await confirmBtn.scrollIntoViewIfNeeded();
    await confirmBtn.click();
    await page.waitForTimeout(5000);
  }

  // Evidence G: Success feedback + audit log
  console.log('Capturing Evidence G (Success Audit Feed)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'transfers_evidence_g_success_audit.png'),
    fullPage: true,
  });

  // Evidence H: Post-transfer Student 360 / Directory
  console.log('Navigating to student directory to capture Evidence H...');
  await page.goto(`${BASE}/fr/dashboard/students`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'transfers_evidence_h_student_360.png'),
    fullPage: false,
  });

  // Mobile Context (Evidence I)
  console.log('Capturing Evidence I (Mobile 390px)...');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    storageState: await context.storageState(),
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(`${BASE}/fr/dashboard/students/transfers`, { waitUntil: 'networkidle', timeout: 90000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'transfers_evidence_i_mobile_390px.png'),
    fullPage: false,
  });
  await mobileCtx.close();

  // Arabic Context (Evidence J)
  console.log('Capturing Evidence J (Arabic RTL)...');
  const arCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ar-MA',
    storageState: await context.storageState(),
  });
  const arPage = await arCtx.newPage();
  await arPage.goto(`${BASE}/ar/dashboard/students/transfers`, { waitUntil: 'networkidle', timeout: 90000 });
  await arPage.waitForTimeout(2000);
  await arPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'transfers_evidence_j_arabic_rtl.png'),
    fullPage: true,
  });
  await arCtx.close();

  await browser.close();
  console.log('All 10 screenshots A-J captured successfully!');
}

run().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
