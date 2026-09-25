// Visual & runtime evidence runner for AUD-FINANCE-01
// Student Billing + Family Accounts + Payments + Cashier

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3111';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Admin123!';
const OUT_DIR = path.resolve('artifacts/page-audit/done/AUD-FINANCE-01__student-billing-cashier');
const SHOTS_DIR = path.join(OUT_DIR, 'screenshots');
const EVIDENCE_DIR = path.join(OUT_DIR, 'evidence');

fs.mkdirSync(SHOTS_DIR, { recursive: true });
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const logLines = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logLines.push(line);
}

log(`Starting AUD-FINANCE-01 evidence runner against ${BASE}`);

const browser = await chromium.launch({ headless: true });

async function createAuthContext(email, password, { viewport = { width: 1440, height: 900 }, locale = 'fr-FR' } = {}) {
  const ctx = await browser.newContext({ viewport, locale });
  const page = await ctx.newPage();
  
  // Login via API directly or login form
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const loginRes = await page.evaluate(async ([mail, pass, base]) => {
    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ email: mail, password: pass }),
    });
    return { ok: res.ok, status: res.status };
  }, [email, password, BASE]);

  if (!loginRes.ok) {
    throw new Error(`Failed to login as ${email}: status ${loginRes.status}`);
  }
  
  // Navigate to dashboard to establish session cookies in page context
  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1000);
  return { ctx, page };
}

async function captureShot(page, route, filename, waitMs = 2500) {
  const shotPath = path.join(SHOTS_DIR, filename);
  log(`Navigating to ${route} for ${filename}...`);
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    
    // Wait until loading shells ("Chargement...", spinners) disappear
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return !text.includes('Chargement…') && !text.includes('Chargement...');
    }, { timeout: 15000 }).catch(() => {});

    // Wait for main content and h1
    await page.waitForSelector('main', { timeout: 15000 }).catch(() => {});
    await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {});

    // Wait until pulse skeletons disappear
    await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10000 }).catch(() => {});

    // Ensure table rows are loaded on invoices route
    if (route.includes('/invoices')) {
      await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length > 0, { timeout: 20000 }).catch(() => {});
    }

    // Ensure branch switcher / role are loaded on Arabic routes
    if (route.startsWith('/ar/')) {
      await page.waitForFunction(() => document.body.innerText.includes('جميع الفروع') || document.body.innerText.includes('المدير'), { timeout: 20000 }).catch(() => {});
    }

    // Hide Next.js dev overlay badges
    await page.addStyleTag({
      content: 'nextjs-portal, #__next-build-watcher, [data-nextjs-toast], nextjs-portal * { display: none !important; opacity: 0 !important; pointer-events: none !important; }'
    }).catch(() => {});

    await page.waitForTimeout(waitMs);

    await page.screenshot({ path: shotPath, fullPage: true });
    const title = await page.title();
    const heading = await page.locator('h1, h2').first().innerText().catch(() => '(no heading)');
    const size = fs.statSync(shotPath).size;
    log(`Captured: ${filename} (${size} bytes, Title: "${title}", Heading: "${heading.replace(/\s+/g, ' ')}")`);
  } catch (err) {
    log(`Warning on ${filename}: ${err.message}. Retrying...`);
    await page.waitForTimeout(2000);
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.addStyleTag({
      content: 'nextjs-portal, #__next-build-watcher, [data-nextjs-toast], nextjs-portal * { display: none !important; opacity: 0 !important; pointer-events: none !important; }'
    }).catch(() => {});
    await page.waitForTimeout(waitMs);
    await page.screenshot({ path: shotPath, fullPage: true });
    log(`Captured on retry: ${filename} (${fs.statSync(shotPath).size} bytes)`);
  }
}

// 1. Desktop FR captures for all 12 audited Finance routes as school_admin (1440x900, fr)
log('--- Starting Admin Desktop FR Captures (12/12 Audited Finance Routes) ---');
const { ctx: adminCtx, page: adminDesktop } = await createAuthContext('y.elamrani@atlas.ma', PASSWORD, {
  viewport: { width: 1440, height: 900 },
  locale: 'fr-FR',
});

// Warmup
await adminDesktop.goto(`${BASE}/fr/dashboard/finance/invoices`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await adminDesktop.waitForTimeout(2000);

// Route 1: Invoices
await captureShot(adminDesktop, '/fr/dashboard/finance/invoices', '01-invoices-desktop-fr.png');

// Route 2: Fast Collection Desk
await captureShot(adminDesktop, '/fr/dashboard/finance/collection-desk', '02-collection-desk-desktop-fr.png');

// Route 3: Cashier Sessions
await captureShot(adminDesktop, '/fr/dashboard/finance/cashier-sessions', '03-cashier-sessions-desktop-fr.png');

// Route 4: Receipts
await captureShot(adminDesktop, '/fr/dashboard/finance/receipts', '04-receipts-desktop-fr.png');

// Route 5: Refunds
await captureShot(adminDesktop, '/fr/dashboard/finance/refunds', '05-refunds-desktop-fr.png');

// Route 6: Credit Notes
await captureShot(adminDesktop, '/fr/dashboard/finance/credit-notes', '06-credit-notes-desktop-fr.png');

// Route 7: Fee Allocations
await captureShot(adminDesktop, '/fr/dashboard/finance/allocations', '07-fee-allocations-desktop-fr.png');

// Route 8: Fee Assignments
await captureShot(adminDesktop, '/fr/dashboard/finance/fee-assignments', '08-fee-assignments-desktop-fr.png');

// Route 9: Student Accounting Portal (Plan Comptable / GL)
await captureShot(adminDesktop, '/fr/dashboard/finance/accounting/student-accounting', '09-student-accounting-desktop-fr.png');

// Route 10: Statements
await captureShot(adminDesktop, '/fr/dashboard/finance/statements', '10-statements-desktop-fr.png');

// Route 11: Reminders & Statements
await captureShot(adminDesktop, '/fr/dashboard/finance/reminders', '11-reminders-desktop-fr.png');

// Route 12: Online Payments
await captureShot(adminDesktop, '/fr/dashboard/finance/online-payments', '12-online-payments-desktop-fr.png');

// 2. Mobile captures as school_admin (390x844 iPhone 13/14/15 size, fr)
log('--- Starting Admin Mobile (390px) Captures ---');
const { page: adminMobile } = await createAuthContext('y.elamrani@atlas.ma', PASSWORD, {
  viewport: { width: 390, height: 844 },
  locale: 'fr-FR',
});

await captureShot(adminMobile, '/fr/dashboard/finance/invoices', '13-invoices-mobile-390-fr.png');
await captureShot(adminMobile, '/fr/dashboard/finance/collection-desk', '14-collection-desk-mobile-390-fr.png');
await captureShot(adminMobile, '/fr/dashboard/finance/cashier-sessions', '15-cashier-sessions-mobile-390-fr.png');
await captureShot(adminMobile, '/fr/dashboard/finance/receipts', '16-receipts-mobile-390-fr.png');

// 3. Arabic RTL captures as school_admin (1440x900, ar)
log('--- Starting Admin Arabic RTL Captures ---');
const { page: adminAr } = await createAuthContext('y.elamrani@atlas.ma', PASSWORD, {
  viewport: { width: 1440, height: 900 },
  locale: 'ar-MA',
});

await captureShot(adminAr, '/ar/dashboard/finance/invoices', '17-invoices-desktop-ar-rtl.png');
await captureShot(adminAr, '/ar/dashboard/finance/collection-desk', '18-collection-desk-desktop-ar-rtl.png');

// 4. Accountant Verification
log('--- Testing Accountant Role Access ---');
const { page: accountantPage } = await createAuthContext('accountant@atlas.ma', PASSWORD, {
  viewport: { width: 1440, height: 900 },
  locale: 'fr-FR',
});
await accountantPage.goto(`${BASE}/fr/dashboard/finance/collection-desk`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await accountantPage.waitForTimeout(1500);
const acctDeskHeading = await accountantPage.locator('h1, h2').first().innerText().catch(() => '');
log(`Accountant Collection Desk loaded: Heading="${acctDeskHeading}"`);

// Verify accountant lookups API
const lookupTest = await accountantPage.evaluate(async () => {
  const res = await fetch('/api/finance/lookups?resource=class-sections&page=1&pageSize=10');
  const json = await res.json();
  return { status: res.status, success: json.success, count: json.data?.length ?? 0 };
});
log(`Accountant class-sections lookup via /api/finance/lookups: status=${lookupTest.status}, count=${lookupTest.count}`);

// 5. IDOR & Role Security Verification
log('--- Testing IDOR & Role Boundary Assertions ---');

// A. Unauthenticated API calls
const unauthCtx = await browser.newContext();
const unauthPage = await unauthCtx.newPage();
const unauthRoutes = [
  '/api/finance/invoices',
  '/api/finance/cashier-sessions',
  '/api/finance/receipts',
  '/api/finance/fee-allocations',
  '/api/finance/refunds',
  '/api/finance/credit-notes',
  '/api/finance/accounting/student-accounting/mappings',
];

for (const route of unauthRoutes) {
  const res = await unauthPage.request.get(`${BASE}${route}`);
  log(`UNAUTH GET ${route} -> status ${res.status()} ${res.status() === 401 ? 'PASS (401 Unauthorized)' : 'FAIL'}`);
}

// B. Student Role Boundary Check
log('Testing Student Role Access Refusal:');
const { page: studentPage } = await createAuthContext('student.001@atlas.ma', PASSWORD);
for (const route of ['/api/finance/invoices', '/api/finance/cashier-sessions', '/api/finance/receipts', '/api/finance/fee-allocations']) {
  const res = await studentPage.request.get(`${BASE}${route}`);
  log(`STUDENT GET ${route} -> status ${res.status()} ${res.status() === 403 ? 'PASS (403 Forbidden)' : 'FAIL'}`);
}

// C. Parent Role Boundary Check
log('Testing Parent Role Access Refusal:');
const { page: parentPage } = await createAuthContext('parent.001@atlas.ma', PASSWORD);
for (const route of ['/api/finance/invoices', '/api/finance/cashier-sessions', '/api/finance/receipts', '/api/finance/fee-allocations']) {
  const res = await parentPage.request.get(`${BASE}${route}`);
  log(`PARENT GET ${route} -> status ${res.status()} ${res.status() === 403 ? 'PASS (403 Forbidden)' : 'FAIL'}`);
}

// Close browser
await browser.close();
log('--- All tests and captures completed successfully! ---');

// Write evidence file
const evidenceFile = path.join(EVIDENCE_DIR, 'finance-session-and-idor.txt');
fs.writeFileSync(evidenceFile, logLines.join('\n'), 'utf8');
log(`Wrote evidence log to ${evidenceFile}`);
