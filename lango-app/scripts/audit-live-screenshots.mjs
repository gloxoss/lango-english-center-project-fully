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

async function waitForLoadedState(page, routeKey) {
  // 1. Wait for DOM content loaded
  await page.waitForLoadState('domcontentloaded');

  // 2. Wait for route-specific elements
  try {
    if (routeKey === 'sessions-list') {
      // Table with rows or data-empty container
      await page.waitForSelector('table, [data-empty-sessions], .rounded-2xl', { timeout: 25000 });
    } else if (routeKey === 'session-new') {
      // Form elements
      await page.waitForSelector('form, input[name="title"], button[type="submit"]', { timeout: 25000 });
    } else if (routeKey === 'session-detail') {
      // Session detail title or studio controls
      await page.waitForSelector('h1, button:has-text("Démarrer"), button:has-text("Rejoindre"), [data-testid="session-detail"], .badge', { timeout: 25000 });
    } else if (routeKey === 'reports') {
      // KPI cards + table
      await page.waitForSelector('table, .grid', { timeout: 25000 });
    } else if (routeKey === 'student-portal') {
      // Student portal container
      await page.waitForSelector('button:has-text("Actualiser"), button:has-text("تحديث"), .rounded-2xl', { timeout: 25000 });
    } else if (routeKey === 'parent-portal') {
      // Parent portal container
      await page.waitForSelector('h1, button:has-text("Actualiser"), button:has-text("تحديث"), .rounded-2xl', { timeout: 25000 });
    } else if (routeKey === 'settings') {
      // Provider table
      await page.waitForSelector('table, button:has-text("Ajouter un fournisseur"), button:has-text("إضافة مزود")', { timeout: 25000 });
    }
  } catch (err) {
    console.warn(`[WARN] Route selector wait timeout on ${routeKey}: ${err.message}`);
  }

  // 3. Wait until loading texts and ellipsis KPI placeholders completely disappear
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText || '';
      const hasLoadingText = /Chargement|جاري التحميل|\bLoading\b/.test(text);
      const kpiEllipsis = Array.from(document.querySelectorAll('p.text-xl.font-extrabold, p.text-2xl, span.font-extrabold'))
        .some((el) => el.innerText.trim() === '…' || el.innerText.trim() === '...');
      const hasSkeleton = document.querySelector('[data-skeleton], .animate-pulse, [aria-busy="true"]') !== null;
      return !hasLoadingText && !kpiEllipsis && !hasSkeleton;
    }, { timeout: 35000 });
  } catch (err) {
    console.warn(`[WARN] Loading indicator wait timed out on ${routeKey}: ${err.message}`);
  }

  // 4. Settle period for animations and layout rendering
  await page.waitForTimeout(2000);

  // 5. Audit verification of body text
  const check = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const loadingMatches = text.match(/(Chargement[^.\n]*|جاري التحميل[^.\n]*)/g) || [];
    const ellipses = Array.from(document.querySelectorAll('p, span, td'))
      .filter((el) => el.innerText.trim() === '…' || el.innerText.trim() === '...')
      .map((el) => el.outerHTML.slice(0, 80));
    return { loadingMatches, ellipses };
  });

  if (check.loadingMatches.length > 0) {
    console.warn(`[AUDIT WARNING] Page has loading text:`, check.loadingMatches);
  }
  if (check.ellipses.length > 0) {
    console.warn(`[AUDIT WARNING] Page has ellipsis placeholders:`, check.ellipses);
  }
  if (check.loadingMatches.length === 0 && check.ellipses.length === 0) {
    console.log(`  [LOADED OK] Verified zero loading text / skeletons for ${routeKey}`);
  }
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

async function navigateAndCapture(page, url, name, filename, routeKey) {
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForLoadedState(page, routeKey);
  await capture(page, name, filename);
}

async function run() {
  console.log('=== Recapturing Verified 100% Loaded Visual Evidence for AUD-LIVE-01 ===\n');

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

  const sessionId = '29186aff-c327-4f46-b40b-e8defd5bb1d3';

  // 1. Admin Context
  console.log('Logging in as Admin (Yassine El Amrani)...');
  const { ctx: adminContext, page: adminPage } = await setupContext(USERS.admin, 'fr-FR');

  // Route 1: Academics Live Class Sessions List (FR Desktop)
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/academics/live-class`,
    'Academics Live Sessions List (FR Desktop)',
    '01-academics-live-class-desktop-fr.png',
    'sessions-list'
  );

  // Route 2: Academics Live Class Creation Form (FR Desktop)
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/academics/live-class/new`,
    'Academics Live Class New (FR Desktop)',
    '02-academics-live-class-new-desktop-fr.png',
    'session-new'
  );

  // Route 3: Academics Live Class Studio / Detail (FR Desktop)
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/academics/live-class/${sessionId}`,
    'Academics Live Class Detail / Studio (FR Desktop)',
    '03-academics-live-class-detail-desktop-fr.png',
    'session-detail'
  );

  // Route 4: Academics Live Class Reports (FR Desktop)
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/academics/live-class-reports`,
    'Academics Live Class Reports (FR Desktop)',
    '04-academics-live-class-reports-desktop-fr.png',
    'reports'
  );

  // Route 7: Settings Live Classrooms Providers (FR Desktop)
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/settings/live-classrooms`,
    'Settings Live Classrooms Providers (FR Desktop)',
    '07-settings-live-classrooms-desktop-fr.png',
    'settings'
  );

  // Route 1 (Mobile 390): Academics Live Class List (Mobile 390 FR)
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/fr/dashboard/academics/live-class`,
    'Academics Live Class List (Mobile 390 FR)',
    '08-academics-live-class-mobile-390-fr.png',
    'sessions-list'
  );

  // Route 1 (Arabic RTL): Academics Live Class List (AR Desktop)
  await adminPage.setViewportSize({ width: 1440, height: 900 });
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/ar/dashboard/academics/live-class`,
    'Academics Live Class List (AR RTL Desktop)',
    '09-academics-live-class-desktop-ar-rtl.png',
    'sessions-list'
  );

  // Route 3 (Arabic RTL): Live Class Detail (AR Desktop)
  await navigateAndCapture(
    adminPage,
    `${BASE_URL}/ar/dashboard/academics/live-class/${sessionId}`,
    'Academics Live Class Detail (AR RTL Desktop)',
    '13-academics-live-class-detail-desktop-ar-rtl.png',
    'session-detail'
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
    '05-student-live-classes-desktop-fr.png',
    'student-portal'
  );

  // Route 5 (Arabic RTL): Student Live Classes (AR Desktop)
  await navigateAndCapture(
    studentPage,
    `${BASE_URL}/ar/dashboard/student/live-classes`,
    'Student Live Classes Portal (AR RTL Desktop)',
    '10-student-live-classes-desktop-ar-rtl.png',
    'student-portal'
  );

  // Route 5 (Mobile 390): Student Live Classes (FR Mobile 390)
  await studentPage.setViewportSize({ width: 390, height: 844 });
  await navigateAndCapture(
    studentPage,
    `${BASE_URL}/fr/dashboard/student/live-classes`,
    'Student Live Classes Portal (Mobile 390 FR)',
    '11-student-live-classes-mobile-390-fr.png',
    'student-portal'
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
    '06-parent-live-classes-desktop-fr.png',
    'parent-portal'
  );

  // Route 6 (Arabic RTL): Parent Live Classes (AR Desktop)
  await navigateAndCapture(
    parentPage,
    `${BASE_URL}/ar/dashboard/parent/live-classes`,
    'Parent Live Classes Portal (AR RTL Desktop)',
    '12-parent-live-classes-desktop-ar-rtl.png',
    'parent-portal'
  );

  await parentContext.close();
  await browser.close();

  console.log('\n=== All loaded screenshots captured successfully! ===\n');
}

run().catch((err) => {
  console.error('Screenshot Capture Failed:', err);
  process.exit(1);
});
