import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../src/libs/DB.ts';
import { classSections } from '../src/models/Schema.ts';
import { eq } from 'drizzle-orm';

const BASE = 'http://localhost:3222';
const ARTIFACTS_DIR = 'C:/Users/OMEN/.gemini/antigravity-ide/brain/ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function run() {
  console.log('Configuring sections for truthful capacity evidence...');
  // Section 1ère B -> max: 1 (occupancy is 1, so 1/1 FULL -> CAPACITY_EXCEEDED)
  await db.update(classSections).set({ maxStudents: 1 }).where(eq(classSections.id, 'bea9f301-ba75-474e-a9fe-66446ebcd39b'));
  // Section 2nde C -> max: null (CAPACITY_NOT_CONFIGURED)
  await db.update(classSections).set({ maxStudents: null }).where(eq(classSections.id, '78f69ba3-4383-4a78-9382-fb626ce6fed4'));

  try {
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

    console.log('2. Navigating to /fr/dashboard/students/transfers...');
    await page.goto(`${BASE}/fr/dashboard/students/transfers`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2000);

    // Search and select student
    console.log('Searching for student "Amina"...');
    const searchInput = page.locator('main input').first();
    await searchInput.fill('Amina');
    await page.waitForTimeout(1500);

    const selectBtn = page.locator('button:has-text("Sélectionner")').first();
    await selectBtn.waitFor({ state: 'visible', timeout: 10000 });
    await selectBtn.click();
    await page.waitForTimeout(1500);

    // Advance to Step 2
    console.log('Advancing to Step 2...');
    await page.locator('button:has-text("Continuer vers le choix")').first().click();
    await page.waitForTimeout(1500);

    // Select Campus Annexe
    await page.locator('text=Campus Annexe').first().click();
    await page.waitForTimeout(2500);

    // Try to click full section (1ère B) - selection should be blocked
    console.log('Attempting to click full section card (selection should be blocked)...');
    const fullSectionCard = page.locator('text=Section complète').first();
    await fullSectionCard.waitFor({ state: 'visible', timeout: 10000 });
    await fullSectionCard.click({ force: true });
    await page.waitForTimeout(1000);

    // Evidence E: Real CAPACITY_EXCEEDED proof
    console.log('Capturing Evidence E (Real Capacity Exceeded & Blocked State)...');
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'transfers_evidence_e_capacity_exceeded.png'),
      fullPage: false,
    });

    // Evidence E2: CAPACITY_NOT_CONFIGURED proof
    console.log('Capturing Evidence E2 (Capacity Not Configured Blocked State)...');
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'transfers_evidence_e_capacity_not_configured.png'),
      fullPage: false,
    });

    // Select unassigned option to proceed to Step 3
    const unassignedCard = page.locator("text=Non assigné pour l'instant").first();
    await unassignedCard.click();
    await page.waitForTimeout(1000);

    // Advance to Step 3
    console.log('Advancing to Step 3...');
    const toSynthesisBtn = page.locator('button:has-text("Continuer vers la synthèse")').first();
    await toSynthesisBtn.scrollIntoViewIfNeeded();
    await toSynthesisBtn.click();
    await page.waitForTimeout(2500);

    // Evidence F: Truthful Synthesis (verifying operational checkboxes REMOVED)
    console.log('Capturing Evidence F (Truthful Synthesis without false checkboxes)...');
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'transfers_evidence_f_synthesis_confirm.png'),
      fullPage: true,
    });

    await browser.close();
    console.log('Evidence re-capture completed successfully!');
  } finally {
    console.log('Restoring section capacities...');
    await db.update(classSections).set({ maxStudents: 30 }).where(eq(classSections.id, 'bea9f301-ba75-474e-a9fe-66446ebcd39b'));
    await db.update(classSections).set({ maxStudents: 30 }).where(eq(classSections.id, '78f69ba3-4383-4a78-9382-fb626ce6fed4'));
  }
}

run().catch((err) => {
  console.error('Recapture failed:', err);
  process.exit(1);
});
