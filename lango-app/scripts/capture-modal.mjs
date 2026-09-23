import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Logging in...');
  await page.goto('http://localhost:3111/fr/login', { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"], input[name="email"]', 'y.elamrani@atlas.ma');
    await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]', { force: true });
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  console.log('Navigating to Admissions Desk...');
  await page.goto('http://localhost:3111/fr/dashboard/students/admissions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // If there is an "Approuver" button, click it to approve candidate
  const approveBtn = page.locator('button:has-text("Approuver")').first();
  if (await approveBtn.isVisible()) {
    console.log('Clicking Approuver to move candidate to approved...');
    await approveBtn.click();
    await page.waitForTimeout(1500);
  }

  // Click Finaliser l'inscription
  const finalizeBtn = page.locator('button:has-text("Finaliser"), button:has-text("inscription")').first();
  if (await finalizeBtn.isVisible()) {
    console.log('Clicking Finaliser l\'inscription to open modal...');
    await finalizeBtn.click();
    await page.waitForTimeout(1500);

    const dest = path.join(ARTIFACTS_DIR, 'admissions-enrollment-confirmation-modal.png');
    await page.screenshot({ path: dest, fullPage: false });
    console.log('SUCCESS: Captured modal screenshot to', dest);
  } else {
    console.log('Finalize button not found, clicking first candidate in list...');
    const candidateBtn = page.locator('.space-y-2 > button').first();
    if (await candidateBtn.isVisible()) {
      await candidateBtn.click();
      await page.waitForTimeout(1000);
      const approveBtn2 = page.locator('button:has-text("Approuver")').first();
      if (await approveBtn2.isVisible()) {
        await approveBtn2.click();
        await page.waitForTimeout(1500);
      }
      const finalizeBtn2 = page.locator('button:has-text("Finaliser"), button:has-text("inscription")').first();
      if (await finalizeBtn2.isVisible()) {
        await finalizeBtn2.click();
        await page.waitForTimeout(1500);
        const dest = path.join(ARTIFACTS_DIR, 'admissions-enrollment-confirmation-modal.png');
        await page.screenshot({ path: dest, fullPage: false });
        console.log('SUCCESS: Captured modal screenshot to', dest);
      }
    }
  }

  await browser.close();
}

main().catch(console.error);
