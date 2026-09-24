import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.VERIFY_BASE || 'http://localhost:3114';
const SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  'artifacts/page-audit/done/AUD-LIVE-01__live-classrooms/screenshots'
);

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const USERS = {
  admin: { email: 'y.elamrani@atlas.ma', password: 'Admin123!' },
  student: { email: 'student.001@atlas.ma', password: 'Admin123!' },
  parent: { email: 'parent.001@atlas.ma', password: 'Admin123!' },
};

async function getSessionCookies(user) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3111',
    },
    body: JSON.stringify({ email: user.email, password: user.password }),
    redirect: 'manual',
  });

  console.log(`  Sign-in response status for ${user.email}: ${res.status}`);
  const rawCookies = res.headers.getSetCookie?.() ?? [];
  const cookies = [];
  for (const raw of rawCookies) {
    const [pair, ...rest] = raw.split(';');
    const eqIdx = pair.indexOf('=');
    if (eqIdx !== -1) {
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      cookies.push({
        name,
        value,
        domain: 'localhost',
        path: '/',
        httpOnly: rest.some((r) => r.trim().toLowerCase() === 'httponly'),
        sameSite: 'Lax',
      });
    }
  }
  console.log(`  Captured cookies: ${cookies.map((c) => c.name).join(', ')}`);
  return cookies;
}

async function capture(page, name, filename) {
  const outPath = path.join(SCREENSHOT_DIR, filename);
  await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal');
    if (portal) portal.remove();
    const style = document.createElement('style');
    style.innerHTML = `
      nextjs-portal, #__next-build-watcher, [data-nextjs-toast] { display: none !important; }
    `;
    document.head.appendChild(style);
  });
  await page.waitForTimeout(1000);

  try {
    await page.screenshot({ path: outPath, fullPage: false, timeout: 15000 });
  } catch (err) {
    console.warn(`[WARN] Standard screenshot timed out on ${filename}, retrying with timeout 5000...`);
    await page.screenshot({ path: outPath, fullPage: false, timeout: 5000 });
  }
  console.log(`[CAPTURE] ${name} -> ${filename}`);
}

async function navigateAndCapture(page, url, name, filename) {
  const outPath = path.join(SCREENSHOT_DIR, filename);
  // Check if file was modified after 22:05 today
  if (fs.existsSync(outPath)) {
    const stat = fs.statSync(outPath);
    if (stat.mtime > new Date('2026-09-24T22:05:00Z')) {
      console.log(`[SKIP] Already freshly captured: ${filename}`);
      return;
    }
  }

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await capture(page, name, filename);
}

async function run() {
  console.log('=== Capturing Visual Evidence for AUD-LIVE-01 ===\n');

  const browser = await chromium.launch({
    headless: true,
  });

  const setupContext = async (user, locale = 'fr-FR', viewport = { width: 1440, height: 900 }) => {
    const cookies = await getSessionCookies(user);
    const ctx = await browser.newContext({
      viewport,
      locale,
    });
    // Abort external Google Fonts network calls that can cause page.screenshot to hang
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    return { ctx, page };
  };

  // 1. Admin Context
  console.log('Logging in as Admin (Yassine El Amrani)...');
  const { ctx: adminContext, page: adminPage } = await setupContext(USERS.admin, 'fr-FR');
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/academics/live-class`,
    'Academics Live Sessions List (FR Desktop)',
    '01-academics-live-class-desktop-fr.png'
  );

  // Route 2: Academics Live Class Creation Form (FR Desktop)
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/academics/live-class/new`,
    'Academics Live Class New (FR Desktop)',
    '02-academics-live-class-new-desktop-fr.png'
  );

  // Route 3: Academics Live Class Studio / Detail (FR Desktop)
  const sessionId = '29186aff-c327-4f46-b40b-e8defd5bb1d3';
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/academics/live-class/${sessionId}`,
    'Academics Live Class Detail / Studio (FR Desktop)',
    '03-academics-live-class-detail-desktop-fr.png'
  );

  // Route 4: Academics Live Class Reports (FR Desktop)
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/academics/live-class-reports`,
    'Academics Live Class Reports (FR Desktop)',
    '04-academics-live-class-reports-desktop-fr.png'
  );

  // Route 7: Settings Live Classrooms Providers (FR Desktop)
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/settings/live-classrooms`,
    'Settings Live Classrooms Providers (FR Desktop)',
    '07-settings-live-classrooms-desktop-fr.png'
  );

  // Route 1 (Mobile 390): Academics Live Class List (Mobile 390 FR)
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/academics/live-class`,
    'Academics Live Class List (Mobile 390 FR)',
    '08-academics-live-class-mobile-390-fr.png'
  );

  // Route 1 (Arabic RTL): Academics Live Class List (AR Desktop)
  await adminPage.setViewportSize({ width: 1440, height: 900 });
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/ar/dashboard/academics/live-class`,
    'Academics Live Class List (AR RTL Desktop)',
    '09-academics-live-class-desktop-ar-rtl.png'
  );

  // Route 3 (Arabic RTL): Live Class Detail (AR Desktop)
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/ar/dashboard/academics/live-class/${sessionId}`,
    'Academics Live Class Detail (AR RTL Desktop)',
    '13-academics-live-class-detail-desktop-ar-rtl.png'
  );

  await adminContext.close();

  // 2. Student Context
  console.log('\nLogging in as Student (Omar Tazi)...');
  const { ctx: studentContext, page: studentPage } = await setupContext(USERS.student, 'fr-FR');

  // Route 5: Student Live Classes (FR Desktop)
  await navigateAndCapture(
    studentPage,
    `${BASE_URL}/fr/dashboard/student/live-classes`,
    'Student Live Classes Portal (FR Desktop)',
    '05-student-live-classes-desktop-fr.png'
  );

  // Route 5 (Arabic RTL): Student Live Classes (AR Desktop)
  await navigateAndCapture(
    studentPage,
    `${BASE_URL}/ar/dashboard/student/live-classes`,
    'Student Live Classes Portal (AR RTL Desktop)',
    '10-student-live-classes-desktop-ar-rtl.png'
  );

  // Route 5 (Mobile 390): Student Live Classes (FR Mobile 390)
  await studentPage.setViewportSize({ width: 390, height: 844 });
  await navigateAndCapture(
    studentPage,
    `${BASE_URL}/fr/dashboard/student/live-classes`,
    'Student Live Classes Portal (Mobile 390 FR)',
    '11-student-live-classes-mobile-390-fr.png'
  );

  await studentContext.close();

  // 3. Parent Context
  console.log('\nLogging in as Parent (Tariq Benjelloun)...');
  const { ctx: parentContext, page: parentPage } = await setupContext(USERS.parent, 'fr-FR');

  // Route 6: Parent Live Classes (FR Desktop)
  await navigateAndCapture(
    parentPage,
    `${BASE_URL}/fr/dashboard/parent/live-classes`,
    'Parent Live Classes Portal (FR Desktop)',
    '06-parent-live-classes-desktop-fr.png'
  );

  // Route 6 (Arabic RTL): Parent Live Classes (AR Desktop)
  await navigateAndCapture(
    parentPage,
    `${BASE_URL}/ar/dashboard/parent/live-classes`,
    'Parent Live Classes Portal (AR RTL Desktop)',
    '12-parent-live-classes-desktop-ar-rtl.png'
  );

  await parentContext.close();
  await browser.close();

  console.log('\n=== All screenshots captured successfully! ===\n');
}

run().catch((err) => {
  console.error('Screenshot Capture Failed:', err);
  process.exit(1);
});
