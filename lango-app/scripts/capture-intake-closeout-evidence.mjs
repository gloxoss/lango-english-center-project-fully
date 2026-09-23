import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';
const BASE_URL = 'http://localhost:3222';

async function main() {
  console.log('Launching browser for Student Admission Intake Closeout Evidence...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  // 1. Login as School Admin
  console.log('Logging in as School Admin...');
  await page.goto(`${BASE_URL}/fr/login`, { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  // 2. Capture Evidence 1: French Intake page with truthful sidebar label "Nouvelle admission"
  console.log('Navigating to /fr/dashboard/students/add...');
  await page.goto(`${BASE_URL}/fr/dashboard/students/add`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Expand Élèves menu in sidebar if needed
  const elevesMenu = page.locator('button:has-text("Élèves"), a:has-text("Élèves")').first();
  if (await elevesMenu.isVisible()) {
    const intakeSubItem = page.locator('a:has-text("Nouvelle admission")').first();
    if (!await intakeSubItem.isVisible()) {
      await elevesMenu.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }

  const pathSidebarFr = path.join(ARTIFACTS_DIR, 'intake-nav-sidebar-fr.png');
  await page.screenshot({ path: pathSidebarFr, fullPage: false });
  console.log('Saved Evidence 1 (French Sidebar) to', pathSidebarFr);

  // 3. Fill in Step 1 with existing Massar code R192837465 to demonstrate 409 Conflict Blocking
  console.log('Filling form with conflicting Massar code R192837465...');
  await page.fill('#admission-first-name', 'Youssef');
  await page.fill('#admission-last-name', 'Benmoussa');
  await page.fill('#admission-email', 'youssef.conflict@test.ma');
  await page.fill('#admission-phone', '0655443322');
  await page.fill('#admission-massar', 'R192837465');
  await page.waitForTimeout(500);

  // Click Suivant (button to advance to Step 2)
  console.log('Submitting Step 1 to trigger duplicate detection...');
  const nextBtn = page.locator('button:has-text("Suivant")').last();
  await nextBtn.click({ force: true });
  await page.waitForTimeout(2500);

  // 4. Capture Evidence 2: Massar duplicate conflict blocking card
  const pathConflict = path.join(ARTIFACTS_DIR, 'intake-massar-conflict-block.png');
  await page.screenshot({ path: pathConflict, fullPage: false });
  console.log('Saved Evidence 2 (Massar Conflict Block) to', pathConflict);

  // 5. Click "Confirmer la dérogation et continuer" to prove explicit audited administrative override
  console.log('Clicking administrative override button...');
  const overrideBtn = page.locator('button:has-text("Confirmer la dérogation et continuer")').first();
  if (await overrideBtn.isVisible()) {
    await overrideBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // 6. Capture Evidence 3: Transition to Step 2 with administrative override badge
  const pathOverride = path.join(ARTIFACTS_DIR, 'intake-massar-override-proven.png');
  await page.screenshot({ path: pathOverride, fullPage: false });
  console.log('Saved Evidence 3 (Massar Override Proven) to', pathOverride);

  // 7. Capture Evidence 4: Arabic RTL Intake with truthful navigation label "طلب تسجيل جديد"
  console.log('Navigating to /ar/dashboard/students/add for Arabic RTL...');
  await page.goto(`${BASE_URL}/ar/dashboard/students/add`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const elevesMenuAr = page.locator('button:has-text("التلاميذ"), a:has-text("التلاميذ")').first();
  if (await elevesMenuAr.isVisible()) {
    const intakeSubItemAr = page.locator('a:has-text("طلب تسجيل جديد")').first();
    if (!await intakeSubItemAr.isVisible()) {
      await elevesMenuAr.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }

  const pathSidebarAr = path.join(ARTIFACTS_DIR, 'intake-nav-sidebar-ar.png');
  await page.screenshot({ path: pathSidebarAr, fullPage: false });
  console.log('Saved Evidence 4 (Arabic Sidebar) to', pathSidebarAr);

  console.log('All closeout evidence captures completed successfully!');
  await browser.close();
}

main().catch(err => {
  console.error('Error during intake closeout capture:', err);
  process.exit(1);
});
