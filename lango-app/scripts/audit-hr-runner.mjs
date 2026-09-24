import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACT_DIR = path.resolve('artifacts/page-audit/done/AUD-HR-01__hr-payroll');
const SCREENSHOTS_DIR = path.join(ARTIFACT_DIR, 'screenshots');
const EVIDENCE_DIR = path.join(ARTIFACT_DIR, 'evidence');
const IDE_ARTIFACTS_DIR = 'C:\\Users\\OMEN\\.gemini\\antigravity-ide\\brain\\3f7760ab-b1f3-4f08-ba0a-c7749d5301e5';

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

async function saveScreenshot(page, filename) {
  const targetPath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: targetPath, fullPage: false });
  console.log(`Saved screenshot: ${filename}`);
  if (fs.existsSync(IDE_ARTIFACTS_DIR)) {
    try {
      fs.copyFileSync(targetPath, path.join(IDE_ARTIFACTS_DIR, filename));
    } catch (e) {}
  }
}

const FORCE = process.argv.includes('--force');

function hasScreenshot(filename) {
  if (FORCE) return false;
  const targetPath = path.join(SCREENSHOTS_DIR, filename);
  return fs.existsSync(targetPath) && fs.statSync(targetPath).size > 10000;
}

async function main() {
  console.log('Starting Playwright HR & Payroll Visual Audit Capture...');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();

  console.log('Logging in as School Admin (y.elamrani@atlas.ma)...');
  const loginRes = await context.request.post('http://localhost:3111/api/auth/sign-in/email', {
    data: { email: 'y.elamrani@atlas.ma', password: 'Admin123!' },
    headers: { Origin: 'http://localhost:3111' }
  });
  console.log('API sign-in status:', loginRes.status());
  await page.goto('http://localhost:3111/fr/dashboard/hr/overview', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('Authenticated URL:', page.url());

  // 1. HR Overview (/fr/dashboard/hr/overview)
  if (!hasScreenshot('01-hr-overview-desktop-fr.png')) {
    console.log('Capturing 01-hr-overview-desktop-fr.png...');
    await page.goto('http://localhost:3111/fr/dashboard/hr/overview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveScreenshot(page, '01-hr-overview-desktop-fr.png');
  }

  // 2. HR Employees Directory (/fr/dashboard/hr/employees)
  if (!hasScreenshot('02-hr-employees-directory-desktop-fr.png')) {
    console.log('Capturing 02-hr-employees-directory-desktop-fr.png...');
    await page.goto('http://localhost:3111/fr/dashboard/hr/employees', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveScreenshot(page, '02-hr-employees-directory-desktop-fr.png');
  }

  // 3. Employee Profile (/fr/dashboard/hr/employees/[id])
  if (FORCE || !hasScreenshot('03-hr-employee-profile-desktop-fr.png')) {
    console.log('Capturing 03-hr-employee-profile-desktop-fr.png...');
    const empRes = await page.request.get('http://localhost:3111/api/hr/employees');
    const empJson = await empRes.json();
    const profileId = empJson.data?.[0]?.id || 'b8682b49-3381-44a6-ad11-ef7508f44a47';
    await page.goto(`http://localhost:3111/fr/dashboard/hr/employees/${profileId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Yassine', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await saveScreenshot(page, '03-hr-employee-profile-desktop-fr.png');
  }

  // 4. Departments (/fr/dashboard/hr/departments)
  if (!hasScreenshot('04-hr-departments-desktop-fr.png')) {
    console.log('Capturing 04-hr-departments-desktop-fr.png...');
    await page.goto('http://localhost:3111/fr/dashboard/hr/departments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveScreenshot(page, '04-hr-departments-desktop-fr.png');
  }

  // 5. Designations (/fr/dashboard/hr/designations)
  if (!hasScreenshot('05-hr-designations-desktop-fr.png')) {
    console.log('Capturing 05-hr-designations-desktop-fr.png...');
    await page.goto('http://localhost:3111/fr/dashboard/hr/designations', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveScreenshot(page, '05-hr-designations-desktop-fr.png');
  }

  // 6. Leave Management (/fr/dashboard/hr/leave-management)
  if (!hasScreenshot('06-hr-leave-management-desktop-fr.png')) {
    console.log('Capturing 06-hr-leave-management-desktop-fr.png...');
    await page.goto('http://localhost:3111/fr/dashboard/hr/leave-management', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveScreenshot(page, '06-hr-leave-management-desktop-fr.png');
  }

  // 7. Salary Advances (/fr/dashboard/hr/salary-advances)
  if (FORCE || !hasScreenshot('07-hr-salary-advances-desktop-fr.png')) {
    console.log('Capturing 07-hr-salary-advances-desktop-fr.png...');
    await page.goto('http://localhost:3111/fr/dashboard/hr/salary-advances', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Karim Tazi', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await saveScreenshot(page, '07-hr-salary-advances-desktop-fr.png');
  }

  // 8. New Employee Wizard (/fr/dashboard/hr/employees/new)
  if (!hasScreenshot('08-hr-employee-wizard-new-desktop-fr.png')) {
    console.log('Capturing 08-hr-employee-wizard-new-desktop-fr.png...');
    await page.goto('http://localhost:3111/fr/dashboard/hr/employees/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveScreenshot(page, '08-hr-employee-wizard-new-desktop-fr.png');
  }

  // 9. Workforce Payroll Runs (/fr/dashboard/workforce/payroll/runs)
  if (!hasScreenshot('09-workforce-payroll-runs-desktop-fr.png')) {
    console.log('Capturing 09-workforce-payroll-runs-desktop-fr.png...');
    await page.goto('http://localhost:3111/fr/dashboard/workforce/payroll/runs', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveScreenshot(page, '09-workforce-payroll-runs-desktop-fr.png');
  }

  // 10. Workforce Payroll Payslips (/fr/dashboard/workforce/payroll/payslips)
  if (!hasScreenshot('10-workforce-payroll-payslips-desktop-fr.png')) {
    console.log('Capturing 10-workforce-payroll-payslips-desktop-fr.png...');
    await page.goto('http://localhost:3111/fr/dashboard/workforce/payroll/payslips', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveScreenshot(page, '10-workforce-payroll-payslips-desktop-fr.png');
  }

  // 11. Mobile HR Overview (390x844)
  if (!hasScreenshot('11-hr-overview-mobile-390-fr.png')) {
    console.log('Capturing 11-hr-overview-mobile-390-fr.png...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3111/fr/dashboard/hr/overview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveScreenshot(page, '11-hr-overview-mobile-390-fr.png');
  }

  // 12. Arabic RTL HR Overview (1440x1050)
  if (!hasScreenshot('12-hr-overview-desktop-ar-rtl.png')) {
    console.log('Capturing 12-hr-overview-desktop-ar-rtl.png...');
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto('http://localhost:3111/ar/dashboard/hr/overview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await saveScreenshot(page, '12-hr-overview-desktop-ar-rtl.png');
  }

  await browser.close();
  console.log('HR & Payroll Visual Capture successfully completed!');
}

main().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
