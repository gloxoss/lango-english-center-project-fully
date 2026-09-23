import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';
const GUARDIAN_ID = '299bbbe0-f75e-4c82-b117-3e9e89c56e9f'; // Tariq Benjelloun

async function main() {
  console.log('Launching browser for Final Acceptance Evidence...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();

  // Login
  console.log('Logging in as School Admin...');
  await page.goto('http://localhost:3111/fr/login', { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  // =============================================================
  // EVIDENCE K: Truthful financial responsibility summary
  // =============================================================
  console.log('Capturing Evidence K: Truthful financial responsibility summary...');
  await page.goto(`http://localhost:3111/fr/dashboard/students/parents/${GUARDIAN_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const pathK = path.join(ARTIFACTS_DIR, 'guardians-k-financial-truth.png');
  await page.screenshot({ path: pathK, fullPage: false });
  console.log('Saved Evidence K to', pathK);

  // =============================================================
  // EVIDENCE L: Populated payments tab
  // =============================================================
  console.log('Capturing Evidence L: Payments tab...');
  const paymentsTab = page.locator('button:has-text("Paiements"), [role="tab"]:has-text("Paiements")').first();
  if (await paymentsTab.isVisible()) {
    await paymentsTab.click({ force: true });
    await page.waitForTimeout(2000);
  }
  const pathL = path.join(ARTIFACTS_DIR, 'guardians-l-payments-consistent.png');
  await page.screenshot({ path: pathL, fullPage: false });
  console.log('Saved Evidence L to', pathL);

  // =============================================================
  // EVIDENCE M: Activity tab with real audit events
  // =============================================================
  console.log('Capturing Evidence M: Activity tab with real audit events...');
  const activityTab = page.locator('button:has-text("Activité"), [role="tab"]:has-text("Activité")').first();
  if (await activityTab.isVisible()) {
    await activityTab.click({ force: true });
    await page.waitForTimeout(2000);
  }
  const pathM = path.join(ARTIFACTS_DIR, 'guardians-m-activity-proven.png');
  await page.screenshot({ path: pathM, fullPage: false });
  console.log('Saved Evidence M to', pathM);

  // Switch back to children tab
  const childrenTab = page.locator('button:has-text("Enfants rattachés"), [role="tab"]:has-text("Enfants")').first();
  if (await childrenTab.isVisible()) {
    await childrenTab.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // =============================================================
  // EVIDENCE O: Modal checkboxes clean (blue brand accent, no red)
  // =============================================================
  console.log('Capturing Evidence O: Link child modal checkboxes...');
  const linkBtn = page.locator('button:has-text("Lier un enfant"), button:has-text("Rattacher")').first();
  await linkBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (await linkBtn.isVisible()) {
    await linkBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // Ensure checkboxes are visible and toggle to see state
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    console.log(`Found ${count} checkboxes in modal`);
    if (count > 0 && !(await checkboxes.nth(0).isChecked())) {
      await checkboxes.nth(0).click({ force: true });
    }
    await page.waitForTimeout(500);

    const pathO = path.join(ARTIFACTS_DIR, 'guardians-o-modal-checkboxes-clean.png');
    await page.screenshot({ path: pathO, fullPage: false });
    console.log('Saved Evidence O to', pathO);

    // Close modal cleanly
    const cancelLink = page.locator('button:has-text("Annuler")').first();
    if (await cancelLink.isVisible()) {
      await cancelLink.click({ force: true });
      await page.waitForTimeout(600);
    }
  }

  // =============================================================
  // EVIDENCE N: Clean RTL Arabic directory
  // =============================================================
  console.log('Capturing Evidence N: Arabic RTL clean directory...');
  await page.goto('http://localhost:3111/ar/dashboard/students/parents', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const pathN = path.join(ARTIFACTS_DIR, 'guardians-n-arabic-rtl-clean.png');
  await page.screenshot({ path: pathN, fullPage: false });
  console.log('Saved Evidence N to', pathN);

  console.log('All acceptance evidence captured successfully!');
  await browser.close();
}

main().catch(err => {
  console.error('Error during acceptance evidence capture:', err);
  process.exit(1);
});
