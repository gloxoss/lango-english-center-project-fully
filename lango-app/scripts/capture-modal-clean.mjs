import { chromium } from 'playwright';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\ead20cd7-a5ed-4d1a-98cf-1b248648e7e7';

async function main() {
  console.log('Launching browser to capture admissions enrollment confirmation modal...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Logging in as School Admin...');
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

  // 1. Try to switch to "Approuvées" tab first
  const approvedTab = page.locator('button:has-text("Approuvées")').first();
  if (await approvedTab.isVisible()) {
    console.log('Switching to Approuvées tab...');
    await approvedTab.click();
    await page.waitForTimeout(1500);
  }

  // Check if a candidate is present in list
  let finalizeBtn = page.locator('button:has-text("Finaliser l\'inscription")').first();

  if (!(await finalizeBtn.isVisible())) {
    console.log('No approved candidate currently selected, checking first item in list...');
    const candidateItem = page.locator('.cursor-pointer, .space-y-2 > button').first();
    if (await candidateItem.isVisible()) {
      await candidateItem.click();
      await page.waitForTimeout(1500);
    }
  }

  finalizeBtn = page.locator('button:has-text("Finaliser l\'inscription")').first();

  // If still not visible, go to "En attente" and approve the first candidate
  if (!(await finalizeBtn.isVisible())) {
    console.log('Finalize button still not visible. Switching to "En attente" to approve one candidate...');
    const pendingTab = page.locator('button:has-text("En attente")').first();
    if (await pendingTab.isVisible()) {
      await pendingTab.click();
      await page.waitForTimeout(1500);
    }
    const candidateItem = page.locator('.cursor-pointer, .space-y-2 > button').first();
    if (await candidateItem.isVisible()) {
      await candidateItem.click();
      await page.waitForTimeout(1000);
    }
    const approveBtn = page.locator('button:has-text("Approuver l\'admission")').first();
    if (await approveBtn.isVisible()) {
      console.log('Clicking "Approuver l\'admission"...');
      await approveBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  finalizeBtn = page.locator('button:has-text("Finaliser l\'inscription")').first();
  if (await finalizeBtn.isVisible()) {
    console.log('Clicking "Finaliser l\'inscription" to open modal...');
    await finalizeBtn.click();
    await page.waitForTimeout(1500);

    const dest = path.join(ARTIFACTS_DIR, 'admissions-enrollment-confirmation-modal.png');
    await page.screenshot({ path: dest, fullPage: false });
    console.log('SUCCESS: Captured enrollment confirmation modal to', dest);
  } else {
    console.error('ERROR: Could not find "Finaliser l\'inscription" button!');
    // Take fallback screenshot to inspect what is on the page
    const debugPath = path.join(ARTIFACTS_DIR, 'debug-admissions-modal.png');
    await page.screenshot({ path: debugPath });
    console.log('Debug screenshot saved to', debugPath);
  }

  await browser.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
