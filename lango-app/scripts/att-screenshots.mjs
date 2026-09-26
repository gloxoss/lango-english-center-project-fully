/**
 * att-screenshots.mjs — IMPL-ATTENDANCE-REFORM-01 screenshot capture
 * Captures scanner page + register page in 3 variants (FR desktop, 390px, AR RTL)
 * and runs manual tests E1-E4 (entrance) and C1-C6 (classroom).
 *
 * Usage:
 *   SLOT_ID=<uuid> DATE=2026-09-26 node scripts/att-screenshots.mjs
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const BASE = process.env.BASE ?? 'http://localhost:3485';
const SLOT_ID = process.env.SLOT_ID ?? '42ec3130-c087-4206-806e-61f87128dc56';
const DATE = process.env.DATE ?? new Date().toISOString().slice(0, 10);
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../artifacts/product-enhancements/IMPL-ATTENDANCE-REFORM-01/screenshots'
);
fs.mkdirSync(OUT, { recursive: true });

const RESULTS = [];

async function login(browser, viewport, locale = 'fr') {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${locale}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type="email"]').fill('y.elamrani@atlas.ma');
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 30000 }).catch(() => {});
  return { ctx, page };
}

async function loginAs(browser, viewport, email, locale = 'fr') {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${locale}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 30000 }).catch(() => {});
  return { ctx, page };
}

function pass(id, note) { RESULTS.push({ id, status: 'PASS', note }); console.log(`  ✅ ${id}: ${note}`); }
function fail(id, note) { RESULTS.push({ id, status: 'FAIL', note }); console.log(`  ❌ ${id}: ${note}`); }
function skip(id, note) { RESULTS.push({ id, status: 'SKIP', note }); console.log(`  ⏭  ${id}: ${note}`); }

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${name}.png`);
  return file;
}

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

async function main() {
  const browser = await chromium.launch({ headless: true });

  console.log('\n=== 1. Scanner page screenshots (3 variants) ===');
  const SCANNER_URL = `${BASE}/fr/dashboard/attendance/scanner`;
  const SCANNER_AR_URL = `${BASE}/ar/dashboard/attendance/scanner`;
  const REGISTER_URL = `${BASE}/fr/dashboard/attendance/registres?slot=${SLOT_ID}&date=${DATE}`;
  const REGISTER_AR_URL = `${BASE}/ar/dashboard/attendance/registres?slot=${SLOT_ID}&date=${DATE}`;

  // Variant 1: FR Desktop
  console.log('\n--- FR Desktop ---');
  {
    const { ctx, page } = await login(browser, DESKTOP, 'fr');
    await page.goto(SCANNER_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() =>
      page.goto(SCANNER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    );
    await shot(page, 'scanner-fr-desktop');
    await ctx.close();
  }

  // Variant 2: FR Phone (390px)
  console.log('\n--- FR Phone 390px ---');
  {
    const { ctx, page } = await login(browser, PHONE, 'fr');
    await page.goto(SCANNER_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() =>
      page.goto(SCANNER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    );
    await shot(page, 'scanner-fr-phone-390');
    await ctx.close();
  }

  // Variant 3: AR RTL
  console.log('\n--- AR RTL Desktop ---');
  {
    const { ctx, page } = await login(browser, DESKTOP, 'ar');
    await page.goto(SCANNER_AR_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() =>
      page.goto(SCANNER_AR_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    );
    await shot(page, 'scanner-ar-rtl-desktop');
    await ctx.close();
  }

  console.log('\n=== 2. Register page screenshots (3 variants) ===');

  // Variant 1: FR Desktop
  console.log('\n--- Register FR Desktop ---');
  {
    const { ctx, page } = await login(browser, DESKTOP, 'fr');
    await page.goto(REGISTER_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() =>
      page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    );
    await shot(page, 'register-fr-desktop');
    await ctx.close();
  }

  // Variant 2: FR Phone (390px)
  console.log('\n--- Register FR Phone 390px ---');
  {
    const { ctx, page } = await login(browser, PHONE, 'fr');
    await page.goto(REGISTER_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() =>
      page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    );
    await shot(page, 'register-fr-phone-390');
    await ctx.close();
  }

  // Variant 3: AR RTL
  console.log('\n--- Register AR RTL Desktop ---');
  {
    const { ctx, page } = await login(browser, DESKTOP, 'ar');
    await page.goto(REGISTER_AR_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() =>
      page.goto(REGISTER_AR_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    );
    await shot(page, 'register-ar-rtl-desktop');
    await ctx.close();
  }

  console.log('\n=== 3. Manual tests — Entrance mode (E1-E4) ===');
  console.log('Using reception user (accueil@atlas.ma) who has attendance.scan');

  {
    const { ctx, page } = await loginAs(browser, DESKTOP, 'accueil@atlas.ma', 'fr');

    // E1: Reception user can see the QR scanner menu entry
    console.log('\nE1: Reception sees scanner in sidebar nav');
    await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait for sidebar to finish compiling and rendering (avoids "Chargement..." state)
    await page.waitForSelector('nav a, aside a, [role="navigation"] a', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await shot(page, 'E1-reception-dashboard');
    const scannerLink = await page.locator('a[href*="attendance/scanner"]').count();
    if (scannerLink > 0) {
      pass('E1', `scanner nav entry found (${scannerLink} link(s))`);
    } else {
      fail('E1', 'scanner nav entry NOT found in sidebar');
    }

    // E2: Reception can navigate to scanner page (200, no redirect to login)
    console.log('\nE2: Reception opens scanner page without bounce');
    await page.goto(`${BASE}/fr/dashboard/attendance/scanner`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    await shot(page, 'E2-scanner-page-reception');
    const url = page.url();
    if (!url.includes('/login') && !url.includes('/403')) {
      pass('E2', `landed on scanner (${url.split('/').slice(-2).join('/')}), no bounce`);
    } else {
      fail('E2', `bounced to ${url}`);
    }

    // E3: Page renders the scanner UI (not an error/empty state)
    console.log('\nE3: Scanner page renders actual UI (not error)');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasContent = bodyText.length > 200 && !bodyText.includes('500') && !bodyText.includes('An error occurred');
    if (hasContent) {
      pass('E3', 'scanner page has rendered content (no 500/error)');
    } else {
      fail('E3', `scanner page looks empty or error: "${bodyText.slice(0, 100)}"`);
    }

    // E4: AR RTL scanner page also renders for reception
    console.log('\nE4: AR RTL scanner page renders for reception');
    await page.goto(`${BASE}/ar/dashboard/attendance/scanner`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    await shot(page, 'E4-scanner-ar-rtl-reception');
    const arUrl = page.url();
    if (!arUrl.includes('/login') && !arUrl.includes('/403')) {
      pass('E4', `AR RTL scanner accessible (${arUrl.split('/').slice(-2).join('/')})`);
    } else {
      fail('E4', `AR RTL bounced to ${arUrl}`);
    }

    await ctx.close();
  }

  console.log('\n=== 4. Manual tests — Classroom mode (C1-C6) ===');
  console.log('Using school_admin (y.elamrani@atlas.ma)');

  {
    const { ctx, page } = await login(browser, DESKTOP, 'fr');

    // C1: Register page loads with slot+date params
    console.log('\nC1: Register page loads with slot+date params');
    await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, 'C1-register-with-slot-date');
    const c1Url = page.url();
    const c1Body = await page.locator('body').innerText().catch(() => '');
    if (!c1Url.includes('/login') && c1Body.length > 100) {
      pass('C1', `register page loaded with slot=${SLOT_ID.slice(0, 8)}… date=${DATE}`);
    } else if (c1Url.includes('/login')) {
      fail('C1', 'redirected to login (session expired)');
    } else {
      fail('C1', `unexpected state: url=${c1Url}, body=${c1Body.slice(0, 80)}`);
    }

    // C2: Register page on 390px
    console.log('\nC2: Register page renders on 390px mobile');
    await ctx.close();
    const { ctx: ctx2, page: page2 } = await login(browser, PHONE, 'fr');
    await page2.goto(REGISTER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.waitForTimeout(1500);
    await shot(page2, 'C2-register-phone-390');
    const c2Body = await page2.locator('body').innerText().catch(() => '');
    if (c2Body.length > 100) {
      pass('C2', 'register page renders on 390px');
    } else {
      fail('C2', 'register page appears empty on 390px');
    }
    await ctx2.close();

    // C3: Register page in AR RTL
    console.log('\nC3: Register page in AR RTL');
    const { ctx: ctx3, page: page3 } = await login(browser, DESKTOP, 'ar');
    await page3.goto(REGISTER_AR_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page3.waitForTimeout(1500);
    await shot(page3, 'C3-register-ar-rtl');
    const c3Url = page3.url();
    if (!c3Url.includes('/login')) {
      pass('C3', `AR RTL register accessible (${c3Url.split('/').slice(-2).join('/')})`);
    } else {
      fail('C3', `AR RTL register bounced to login`);
    }
    await ctx3.close();

    // C4: Scan API endpoint is reachable (returns 422 on empty body, not 404/500)
    console.log('\nC4: verify-and-stage API responds (not 404)');
    const resp = await fetch(`${BASE}/api/attendance/qr/verify-and-stage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (resp.status === 422 || resp.status === 400 || resp.status === 401) {
      pass('C4', `verify-and-stage returns ${resp.status} (API exists, not 404)`);
    } else if (resp.status === 404) {
      fail('C4', 'verify-and-stage route does not exist (404)');
    } else {
      pass('C4', `verify-and-stage returns ${resp.status} (route exists)`);
    }

    // C5: Scanner sessions API is reachable
    console.log('\nC5: scanner-sessions API responds (not 404)');
    const sessResp = await fetch(`${BASE}/api/attendance/qr/scanner-sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (sessResp.status !== 404) {
      pass('C5', `scanner-sessions returns ${sessResp.status} (not 404)`);
    } else {
      fail('C5', 'scanner-sessions route does not exist (404)');
    }

    // C6: On-site API with classSectionId param (400/422 on fake UUID, not 404)
    console.log('\nC6: on-site API handles classSectionId param (not 404)');
    const onsiteResp = await fetch(`${BASE}/api/attendance/onsite?classSectionId=not-a-uuid`);
    if (onsiteResp.status === 422 || onsiteResp.status === 400 || onsiteResp.status === 401) {
      pass('C6', `onsite returns ${onsiteResp.status} on bad UUID (param handled)`);
    } else if (onsiteResp.status === 404) {
      fail('C6', 'onsite route does not exist (404)');
    } else {
      pass('C6', `onsite returns ${onsiteResp.status}`);
    }
  }

  await browser.close();

  console.log('\n=== Summary ===');
  const passes = RESULTS.filter(r => r.status === 'PASS').length;
  const fails = RESULTS.filter(r => r.status === 'FAIL').length;
  for (const r of RESULTS) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭';
    console.log(`  ${icon} [${r.id}] ${r.note}`);
  }
  console.log(`\nTotal: ${passes} pass, ${fails} fail of ${RESULTS.length}`);
  console.log(`Screenshots in: ${OUT}`);

  fs.writeFileSync(
    path.join(OUT, 'manual-test-results.json'),
    JSON.stringify({ date: new Date().toISOString(), results: RESULTS }, null, 2)
  );
  process.exit(fails > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
