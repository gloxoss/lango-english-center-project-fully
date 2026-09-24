import { chromium } from 'playwright';
import path from 'node:path';

const BASE_URL = 'http://localhost:3111';
const SHOT_DIR = path.resolve('artifacts/page-audit/done/AUD-STUDENT-01__student-portal/screenshots');

async function main() {
  console.log('Starting Playwright audit for AUD-STUDENT-01 (Student Portal)...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'fr-FR',
  });

  const page = await context.newPage();

  // 1. Log in as student
  console.log('Navigating to login page...');
  await page.goto(`${BASE_URL}/fr/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('Filling login credentials...');
  await page.fill('input[type="email"], input[name="email"]', 'student.001@atlas.ma');
  await page.fill('input[type="password"], input[name="password"]', 'Admin123!');
  await page.click('button[type="submit"]');

  await page.waitForURL(url => url.pathname.includes('/dashboard'), { timeout: 20000 });
  console.log('Logged in successfully. Current URL:', page.url());

  // 2. Student Portal Home - Today Tab (Desktop FR)
  console.log('Navigating to student portal...');
  await page.goto(`${BASE_URL}/fr/dashboard/student`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOT_DIR, '01-student-home-today-desktop-fr.png'), fullPage: true });
  console.log('Captured 01-student-home-today-desktop-fr.png');

  // Helper to click tab by index (0: today, 1: timetable, 2: subjects, 3: attendance)
  async function clickPortalTab(idx) {
    const tabBtns = await page.$$('div.flex.gap-1.border-b button');
    if (tabBtns && tabBtns[idx]) {
      await tabBtns[idx].click();
      await page.waitForTimeout(1000);
    }
  }

  // 3. Student Portal - Timetable Tab (Desktop FR)
  await clickPortalTab(1);
  await page.screenshot({ path: path.join(SHOT_DIR, '02-student-timetable-desktop-fr.png'), fullPage: true });
  console.log('Captured 02-student-timetable-desktop-fr.png');

  // 4. Student Portal - Subjects Tab (Desktop FR)
  await clickPortalTab(2);
  await page.screenshot({ path: path.join(SHOT_DIR, '03-student-subjects-desktop-fr.png'), fullPage: true });
  console.log('Captured 03-student-subjects-desktop-fr.png');

  // 5. Student Portal - Attendance Tab (Desktop FR)
  await clickPortalTab(3);
  await page.screenshot({ path: path.join(SHOT_DIR, '04-student-attendance-desktop-fr.png'), fullPage: true });
  console.log('Captured 04-student-attendance-desktop-fr.png');

  // 6. Mobile 390px Viewport (FR)
  await page.setViewportSize({ width: 390, height: 844 });
  await clickPortalTab(0);
  await page.screenshot({ path: path.join(SHOT_DIR, '05-student-home-mobile-390-fr.png'), fullPage: true });
  console.log('Captured 05-student-home-mobile-390-fr.png');

  // 7. Arabic RTL Desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/ar/dashboard/student`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOT_DIR, '06-student-home-desktop-ar-rtl.png'), fullPage: true });
  console.log('Captured 06-student-home-desktop-ar-rtl.png');

  // 8. Arabic RTL Timetable Tab
  await clickPortalTab(1);
  await page.screenshot({ path: path.join(SHOT_DIR, '07-student-timetable-desktop-ar-rtl.png'), fullPage: true });
  console.log('Captured 07-student-timetable-desktop-ar-rtl.png');

  // 9. Live classes page (Desktop FR)
  await page.goto(`${BASE_URL}/fr/dashboard/student/live-classes`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOT_DIR, '08-student-live-classes-desktop-fr.png'), fullPage: true });
  console.log('Captured 08-student-live-classes-desktop-fr.png');

  // 10. Hostel self-service page (Desktop FR)
  await page.goto(`${BASE_URL}/fr/dashboard/hostel/me`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOT_DIR, '09-student-hostel-me-desktop-fr.png'), fullPage: true });
  console.log('Captured 09-student-hostel-me-desktop-fr.png');

  // 11. Transport self-service page (Desktop FR)
  await page.goto(`${BASE_URL}/fr/dashboard/transport/student`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOT_DIR, '10-student-transport-desktop-fr.png'), fullPage: true });
  console.log('Captured 10-student-transport-desktop-fr.png');

  // 12. Library self-service page (Desktop FR)
  await page.goto(`${BASE_URL}/fr/dashboard/library/me`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOT_DIR, '11-student-library-me-desktop-fr.png'), fullPage: true });
  console.log('Captured 11-student-library-me-desktop-fr.png');

  await browser.close();
  console.log('Playwright student portal audit finished successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
