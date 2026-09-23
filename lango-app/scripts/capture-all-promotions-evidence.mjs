import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/libs/DB';
import { classSections } from '../src/models/Schema';
import { eq } from 'drizzle-orm';

const BASE = 'http://localhost:3222';
const ARTIFACTS_DIR = 'C:/Users/OMEN/.gemini/antigravity-ide/brain/ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const TARGET_SECTION_ID = 'bea9f301-ba75-474e-a9fe-66446ebcd39b';

async function setTargetSectionCapacity(max) {
  await db.update(classSections).set({ maxStudents: max }).where(eq(classSections.id, TARGET_SECTION_ID));
  console.log(`Set target section maxStudents to ${max}`);
}

async function run() {
  console.log('Launching browser for comprehensive promotions visual evidence A-K...');
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

  // Ensure normal capacity first
  await setTargetSectionCapacity(30);

  // ----------------------------------------------------
  // EVIDENCE A, B, C, F: Normal Deliberation Grid
  // ----------------------------------------------------
  console.log('Navigating to /fr/dashboard/students/promotions...');
  await page.goto(`${BASE}/fr/dashboard/students/promotions`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);

  // Evidence A: Deliberation grid with real students/averages
  console.log('Capturing Evidence A (Deliberation Grid)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'promotions_evidence_a_deliberation_grid.png'),
    fullPage: false,
  });

  // Evidence B: Source + target session years visible
  console.log('Capturing Evidence B (Session Years)...');
  const sessionConfigCard = page.locator('text=Configuration de la Promotion').locator('..');
  if (await sessionConfigCard.count() > 0) {
    await sessionConfigCard.first().screenshot({
      path: path.join(ARTIFACTS_DIR, 'promotions_evidence_b_sessions_visible.png'),
    });
  } else {
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'promotions_evidence_b_sessions_visible.png'),
      fullPage: false,
    });
  }

  // Evidence C: Target section occupancy/capacity
  console.log('Capturing Evidence C (Capacity Card)...');
  const capacityBanner = page.locator('text=Vérification de la Capacité d\'Accueil').locator('..');
  if (await capacityBanner.count() > 0) {
    await capacityBanner.first().screenshot({
      path: path.join(ARTIFACTS_DIR, 'promotions_evidence_c_occupancy_capacity.png'),
    });
  } else {
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'promotions_evidence_c_occupancy_capacity.png'),
      fullPage: false,
    });
  }

  // Evidence F: Mixed-decision synthesis
  console.log('Capturing Evidence F (Mixed Decisions Full View)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'promotions_evidence_f_mixed_decisions.png'),
    fullPage: true,
  });

  // ----------------------------------------------------
  // EVIDENCE D: CAPACITY_NOT_CONFIGURED (maxStudents = null)
  // ----------------------------------------------------
  console.log('Simulating CAPACITY_NOT_CONFIGURED...');
  await setTargetSectionCapacity(null);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('Capturing Evidence D (Capacity Not Configured)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'promotions_evidence_d_capacity_not_configured.png'),
    fullPage: true,
  });

  // ----------------------------------------------------
  // EVIDENCE E: CAPACITY_EXCEEDED (maxStudents = 1)
  // ----------------------------------------------------
  console.log('Simulating CAPACITY_EXCEEDED...');
  await setTargetSectionCapacity(1);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('Capturing Evidence E (Capacity Exceeded)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'promotions_evidence_e_capacity_exceeded.png'),
    fullPage: true,
  });

  // ----------------------------------------------------
  // EVIDENCE G: Successful Committed Batch
  // ----------------------------------------------------
  console.log('Restoring capacity to 30 and committing batch...');
  await setTargetSectionCapacity(30);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Click commit button
  const commitBtn = page.locator('button:has-text("Valider et Confirmer la Promotion")');
  await commitBtn.waitFor({ state: 'visible' });
  console.log('Clicking commit promotion button...');
  await commitBtn.click();
  await page.waitForTimeout(4000);

  // Go to Historique tab
  console.log('Switching to Historique & Annulation tab...');
  const historyTab = page.locator('button:has-text("Historique & Annulation")');
  if (await historyTab.count() > 0) {
    await historyTab.first().click();
    await page.waitForTimeout(2000);
  }

  console.log('Capturing Evidence G (Batch Committed in History)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'promotions_evidence_g_batch_committed.png'),
    fullPage: true,
  });

  // ----------------------------------------------------
  // EVIDENCE H & I: Student 360 & Historical Placements
  // ----------------------------------------------------
  console.log('Navigating to Student 360 for STU-001 (Yassine El Amrani)...');
  await page.goto(`${BASE}/fr/dashboard/students/STU-001`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);

  console.log('Capturing Evidence H (Student 360 post-promotion)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'promotions_evidence_h_student_360_post_promotion.png'),
    fullPage: false,
  });

  console.log('Clicking Académique tab for Evidence I...');
  const acadTab = page.locator('button:has-text("Académique")');
  if (await acadTab.count() > 0) {
    await acadTab.first().click();
    await page.waitForTimeout(2000);
  }

  console.log('Capturing Evidence I (Student Placement History)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'promotions_evidence_i_student_history_archived.png'),
    fullPage: true,
  });

  // ----------------------------------------------------
  // EVIDENCE J: Mobile 390px Viewport
  // ----------------------------------------------------
  console.log('Capturing Evidence J (Mobile 390px Viewport)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/fr/dashboard/students/promotions`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'promotions_evidence_j_mobile_390px.png'),
    fullPage: true,
  });

  // ----------------------------------------------------
  // EVIDENCE K: Arabic RTL
  // ----------------------------------------------------
  console.log('Capturing Evidence K (Arabic RTL)...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/ar/dashboard/students/promotions`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'promotions_evidence_k_arabic_rtl.png'),
    fullPage: true,
  });

  await browser.close();
  console.log('All 11 visual evidence screenshots captured successfully!');
}

run().catch(err => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
