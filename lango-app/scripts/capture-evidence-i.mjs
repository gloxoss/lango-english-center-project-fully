import { chromium } from 'playwright';
import path from 'node:path';

const BASE = 'http://localhost:3222';
const ARTIFACTS_DIR = 'C:/Users/OMEN/.gemini/antigravity-ide/brain/ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await context.newPage();
  await page.goto(`${BASE}/fr/login`);
  await page.locator('input[type="email"]').fill('y.elamrani@atlas.ma');
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 60000 });
  await page.goto(`${BASE}/fr/dashboard/students/STU-001`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const acadTab = page.locator('button:has-text("Académique")');
  if (await acadTab.count() > 0) {
    await acadTab.first().click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'promotions_evidence_i_student_history_archived.png'), fullPage: true });
  await browser.close();
  console.log('Evidence I successfully recaptured!');
}

run().catch(e => { console.error(e); process.exit(1); });
