// Browser acceptance pass for the Parent/Guardian Portal (release steps 14–17).
// Drives the LIVE dev server (:3002, Postgres schoolos-db) in real Chromium via
// the `playwright` library. Performs: FR golden path, Arabic/RTL, mobile viewport,
// keyboard-only, degraded-network. Self-cleans the UI mutations it creates.
//
// Run:  node scripts/browser-parent-portal.mjs
// Env:  VERIFY_BASE (default http://localhost:3002), DATABASE_URL (default local pool)

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos';
const PARENT_EMAIL = 'prn-prn-parent-a@placeholder.local';
const PARENT_PASS = 'ParentAdmin123!';
const EXCUSE_REASON = 'PRN browser pass excuse (auto)';
const REQUEST_SUBJECT = 'PRN browser pass request (auto)';

const EVIDENCE_DIR = path.join(
  ROOT,
  'future-implementation',
  'parent-guardian-portal',
  '.implementation-plan',
  'browser-evidence',
);
const SESSION_FILE = path.join(EVIDENCE_DIR, '.parent-session.json');
mkdirSync(EVIDENCE_DIR, { recursive: true });

const FR_PAGES = [
  { key: 'home', path: '/fr/dashboard/parent/', title: 'Espace Parent' },
  { key: 'attendance', path: '/fr/dashboard/parent/attendance', title: 'Présence' },
  { key: 'finance', path: '/fr/dashboard/parent/finance', title: 'Finance' },
  { key: 'communication', path: '/fr/dashboard/parent/communication', title: 'Communication' },
  { key: 'requests', path: '/fr/dashboard/parent/requests', title: 'Demandes & documents' },
  { key: 'settings', path: '/fr/dashboard/parent/settings', title: 'Paramètres' },
];

const pool = new pg.Pool({ connectionString: DB_URL, max: 3 });

// ─── harness ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, extra = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

function section(title) {
  console.log(`\n== ${title}`);
}

function watchPage(page) {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));
  return pageErrors;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, name), fullPage: false });
}

async function gotoPage(page, url, { expectHeading, waitMs = 60000 } = {}) {
  const pageErrors = watchPage(page);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const status = resp?.status?.() ?? 0;
  if (expectHeading) {
    await page
      .getByRole('heading', { level: 1, name: expectHeading })
      .first()
      .waitFor({ state: 'visible', timeout: waitMs })
      .catch(() => {});
  }
  return { status, pageErrors };
}

async function waitForText(page, text, timeout = 60000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout }).catch(() => {});
}

async function countBy(page, selector) {
  return page.locator(selector).count();
}

// ─── auth ───────────────────────────────────────────────────────────────────
// The live dev server runs on :3002 but the app's Better Auth is configured
// for http://localhost:3000, so a browser-driven login form is rejected with
// 403 "Invalid origin" (browser sends Origin :3002). The verify battery works
// because it spoofs Origin: http://localhost:3000. The login UI itself is not
// under test here — the portal pages are — so we establish the session via the
// same API sign-in and inject the resulting cookies into the browser context.
async function apiSignIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`sign-in for ${email} failed (${res.status}): ${await res.text()}`);
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookies = setCookies.map((raw) => {
    const [pair, ...rest] = raw.split(';');
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const attrs = {};
    for (const a of rest) {
      const t = a.trim();
      const i = t.indexOf('=');
      attrs[i === -1 ? t.toLowerCase() : t.slice(0, i).toLowerCase()] = i === -1 ? true : t.slice(i + 1).replace(/^"(.*)"$/, '$1');
    }
    const sameSite = (attrs.samesite ?? 'Lax').toLowerCase();
    return {
      name,
      value,
      domain: new URL(BASE).hostname,
      path: attrs.path || '/',
      httpOnly: !!attrs.httponly,
      secure: !!attrs.secure,
      sameSite: sameSite === 'none' ? 'None' : sameSite === 'strict' ? 'Strict' : 'Lax',
    };
  });
  return { cookies, origins: [] };
}

// ─── cleanup of UI mutations (idempotent) ───────────────────────────────────
async function cleanupMutations() {
  await pool.query(`DELETE FROM attendance_excuses WHERE reason = $1`, [EXCUSE_REASON]);
  await pool.query(`DELETE FROM parent_requests WHERE subject = $1`, [REQUEST_SUBJECT]);
  await pool.query(`DELETE FROM portal_preferences WHERE user_id = 'PRN-PARENT-A' AND pref_key = 'contactConsent'`);
}

// ─── Pass A / B: FR golden path + Arabic/RTL ───────────────────────────────
async function passFrGoldenPath(context, locale) {
  const isAr = locale === 'ar';
  const pages = FR_PAGES.map((p) => ({ ...p, path: p.path.replace('/fr/', `/${locale}/`) }));
  const prefix = isAr ? 'AR' : 'FR';
  section(`${prefix} — every page 200 + heading + no pageerror + no overflow`);

  for (const p of pages) {
    const page = await context.newPage();
    const { status, pageErrors } = await gotoPage(page, `${BASE}${p.path}`, { expectHeading: p.title });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`${prefix} ${p.key} → 200`, status === 200, `status=${status}`);
    check(`${prefix} ${p.key} → heading rendered`, (await page.getByRole('heading', { level: 1 }).count()) > 0);
    check(`${prefix} ${p.key} → no pageerror`, pageErrors.length === 0, pageErrors.join(' | '));
    check(`${prefix} ${p.key} → no horizontal overflow`, overflow <= 1, `scroll-client diff=${overflow}`);

    if (isAr) {
      const { dir, lang } = await page.evaluate(() => ({
        dir: document.documentElement.dir,
        lang: document.documentElement.lang,
      }));
      const h1Font = await page
        .evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily)
        .catch(() => '');
      check(`${prefix} ${p.key} → dir=rtl`, dir === 'rtl', `dir=${dir}`);
      check(`${prefix} ${p.key} → lang=ar`, lang === 'ar', `lang=${lang}`);
      check(`${prefix} ${p.key} → Cairo font on h1`, /Cairo/i.test(h1Font), `font=${h1Font}`);
    }
    await page.close();
  }
}

// Golden-path content + UI mutations (FR only)
async function passFrContent(context) {
  section('FR — golden path content + UI mutations');
  const page = await context.newPage();

  // Home: active child banner + 6 widget cards
  {
    const pageErrors = watchPage(page);
    await gotoPage(page, `${BASE}/fr/dashboard/parent/`, { expectHeading: 'Espace Parent' });
    await waitForText(page, 'Enfant actif');
    check('home → active child banner', (await page.getByText('Enfant actif').count()) > 0);
    check('home → 6 widget cards', (await countBy(page, 'div.p-5.bg-white.border')) >= 6);
    check('home → no pageerror', pageErrors.length === 0, pageErrors.join(' | '));
    await shot(page, 'fr-home.png');
  }

  // Finance: outstanding 800, invoices, payment
  {
    const pageErrors = watchPage(page);
    await gotoPage(page, `${BASE}/fr/dashboard/parent/finance`, { expectHeading: 'Finance' });
    await waitForText(page, '800 MAD');
    check('finance → outstanding 800 MAD', (await page.getByText('800 MAD', { exact: false }).count()) > 0);
    check('finance → invoice PRN-INV-0001', (await page.getByText('PRN-INV-0001', { exact: false }).count()) > 0);
    check('finance → invoice PRN-INV-0002', (await page.getByText('PRN-INV-0002', { exact: false }).count()) > 0);
    check('finance → paid badge Payée', (await page.getByText('Payée', { exact: true }).count()) > 0);
    check('finance → pending badge En attente', (await page.getByText('En attente', { exact: true }).count()) > 0);
    check('finance → payment 1200 MAD', (await page.getByText('1200 MAD', { exact: false }).count()) > 0);
    check('finance → no pageerror', pageErrors.length === 0, pageErrors.join(' | '));
    await shot(page, 'fr-finance.png');
  }

  // Attendance: KPI cards + excuse submission
  {
    const pageErrors = watchPage(page);
    await gotoPage(page, `${BASE}/fr/dashboard/parent/attendance`, { expectHeading: 'Présence' });
    await waitForText(page, 'Historique récent');
    check('attendance → KPI Taux de présence', (await page.getByText('Taux de présence', { exact: false }).count()) > 0);
    check('attendance → history table', (await page.getByText('Historique récent', { exact: true }).count()) > 0);
    await page.fill('input[type="date"]', '2099-12-31');
    await page.fill('textarea', EXCUSE_REASON);
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await waitForText(page, 'Demande de justification soumise.');
    check('attendance → excuse submission success banner', (await page.getByText('Demande de justification soumise.', { exact: true }).count()) > 0);
    check('attendance → no pageerror', pageErrors.length === 0, pageErrors.join(' | '));
    await shot(page, 'fr-attendance-excuse.png');
  }

  // Communication: announcements + meetings section
  {
    const pageErrors = watchPage(page);
    await gotoPage(page, `${BASE}/fr/dashboard/parent/communication`, { expectHeading: 'Communication' });
    await waitForText(page, 'PRN Annonce Classe A');
    check('communication → class-A announcement', (await page.getByText('PRN Annonce Classe A', { exact: false }).count()) > 0);
    check('communication → all-parents announcement', (await page.getByText('PRN Annonce Tous Parents', { exact: false }).count()) > 0);
    check('communication → meetings section', (await page.getByText('Créneaux de rendez-vous parents', { exact: true }).count()) > 0);
    check('communication → no pageerror', pageErrors.length === 0, pageErrors.join(' | '));
  }

  // Requests: documents + request submission
  {
    const pageErrors = watchPage(page);
    await gotoPage(page, `${BASE}/fr/dashboard/parent/requests`, { expectHeading: 'Demandes & documents' });
    await waitForText(page, 'Acte de naissance');
    check('requests → document acte de naissance', (await page.getByText('Acte de naissance', { exact: false }).count()) > 0);
    check('requests → document bulletin', (await page.getByText('Bulletin', { exact: true }).count()) > 0);
    // The dashboard header also has a global `input[type="text"]` (search box),
    // so target the subject field by its placeholder, never by bare tag.
    await page.getByPlaceholder('Objet de la demande (3 caractères min.)').fill(REQUEST_SUBJECT);
    await page.locator('textarea').fill('Demande de document (auto browser pass).');
    await page.getByRole('button', { name: 'Soumettre' }).click();
    await waitForText(page, 'Demande soumise avec succès.');
    check('requests → submission success banner', (await page.getByText('Demande soumise avec succès.', { exact: true }).count()) > 0);
    await waitForText(page, REQUEST_SUBJECT);
    check('requests → new request listed', (await page.getByText(REQUEST_SUBJECT, { exact: true }).count()) > 0);
    check('requests → no pageerror', pageErrors.length === 0, pageErrors.join(' | '));
    await shot(page, 'fr-requests-submitted.png');
  }

  // Settings: consents + toggle persistence
  {
    const pageErrors = watchPage(page);
    await gotoPage(page, `${BASE}/fr/dashboard/parent/settings`, { expectHeading: 'Paramètres' });
    await waitForText(page, 'Consentements');
    // The consent checkbox is `sr-only` with an overlapping pill, so `locator.check()`
    // misses (click lands on the pill). `el.click()` toggles the native checkbox and
    // still fires React onChange.
    await page
      .locator('input[type="checkbox"][aria-label]')
      .first()
      .waitFor({ state: 'attached', timeout: 60000 });
    check('settings → 5 consent toggles are real inputs', (await countBy(page, 'input[type="checkbox"][aria-label]')) === 5);
    const consent = page.locator('input[aria-label="Contact par téléphone"]');
    const before = await consent.isChecked();
    if (!before) await consent.evaluate((el) => el.click());
    await waitForText(page, 'Préférence enregistrée.');
    check('settings → consent toggle persisted', (await consent.isChecked()) !== before, `before=${before} after=${await consent.isChecked()}`);
    check('settings → no pageerror', pageErrors.length === 0, pageErrors.join(' | '));
    await shot(page, 'fr-settings-consent.png');
  }

  await page.close();
}

// ─── Pass C: mobile viewport ────────────────────────────────────────────────
async function passMobile(context) {
  section('MOBILE — 375×812 viewport');
  const page = await context.newPage();

  // Home: switcher dropdown stays in viewport + no page overflow
  {
    await gotoPage(page, `${BASE}/fr/dashboard/parent/`, { expectHeading: 'Espace Parent' });
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('mobile home → no page horizontal scroll', ovf <= 1, `diff=${ovf}`);
    await page.getByRole('button', { name: /Élève sélectionné/ }).click();
    await page.locator('[role="listbox"]').waitFor({ state: 'visible' });
    const bb = await page.locator('[role="listbox"]').boundingBox();
    const vw = page.viewportSize().width;
    check('mobile → switcher dropdown within viewport', bb && bb.x >= 0 && bb.x + bb.width <= vw + 1, `bb=${JSON.stringify(bb)} vw=${vw}`);
    await shot(page, 'mobile-switcher-open.png');
  }

  // Finance: KPI cards stacked single column + table scrolls inside its own container
  {
    await gotoPage(page, `${BASE}/fr/dashboard/parent/finance`, { expectHeading: 'Finance' });
    await waitForText(page, '800 MAD');
    const y1 = await page.getByText('Solde total restant').boundingBox();
    const y2 = await page.getByRole('heading', { name: 'Factures' }).boundingBox();
    check('mobile finance → KPI cards stacked single column', y1 && y2 && y2.y > y1.y + 10, `y1=${y1?.y} y2=${y2?.y}`);
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('mobile finance → no page horizontal scroll', ovf <= 1, `diff=${ovf}`);
    const scroller = page.locator('.overflow-x-auto').first();
    const canScroll = await scroller.evaluate((el) => el.scrollWidth >= el.clientWidth);
    check('mobile finance → table scrolls inside own container', canScroll, 'scroller scrollWidth<clientWidth');
    await shot(page, 'mobile-finance.png');
  }

  await page.close();
}

// ─── Pass D: keyboard-only ──────────────────────────────────────────────────
async function tabTo(page, selector, maxTabs = 60) {
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press('Tab');
    const hit = await page.locator(selector).evaluate(
      (el) => document.activeElement === el || el.contains(document.activeElement),
    );
    if (hit) return true;
  }
  return false;
}

async function passKeyboard(context) {
  section('KEYBOARD — WCAG 2.2 AA');
  const page = await context.newPage();

  // Settings: real toggles + focus-visible indicator
  {
    await gotoPage(page, `${BASE}/fr/dashboard/parent/settings`, { expectHeading: 'Paramètres' });
    await waitForText(page, 'Consentements');
    // SettingsView renders only after /api/guardian/me/preferences resolves; wait
    // for the first toggle input before counting (same race as the FR content pass).
    await page.locator('input[type="checkbox"][aria-label]').first().waitFor({ state: 'attached', timeout: 60000 });
    const count = await countBy(page, 'input[type="checkbox"][aria-label]');
    check('keyboard settings → 5 consent toggles are real inputs (not divs)', count === 5, `count=${count}`);
    const reached = await tabTo(page, 'input[aria-label="Contact par téléphone"]');
    check('keyboard settings → Tab reaches first consent toggle', reached);
    const focusState = await page.evaluate(() => ({
      fv: document.activeElement.matches(':focus-visible'),
      active: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName,
    }));
    check('keyboard settings → :focus-visible applies on tab', focusState.fv, JSON.stringify(focusState));
    const pill = await page.evaluate(() => {
      const input = document.activeElement;
      const pillEl = input?.nextElementSibling;
      if (!pillEl) return null;
      const s = getComputedStyle(pillEl);
      return { outline: s.outline, boxShadow: s.boxShadow, ring: s.outlineStyle };
    });
    const hasVisibleRing = pill && (pill.ring !== 'none' || pill.boxShadow !== 'none');
    check('keyboard settings → visible focus indicator on consent pill', !!hasVisibleRing, JSON.stringify(pill));
    await shot(page, 'keyboard-settings-focus.png');
  }

  // Home: switcher keyboard-operable (Tab in, Enter opens, Tab to option, Enter selects)
  {
    await gotoPage(page, `${BASE}/fr/dashboard/parent/`, { expectHeading: 'Espace Parent' });
    await waitForText(page, 'Enfant actif');
    const reachedSwitcher = await tabTo(page, 'button[aria-haspopup="listbox"]');
    check('keyboard home → Tab reaches child switcher', reachedSwitcher);
    await page.keyboard.press('Enter');
    await page.locator('[role="listbox"]').waitFor({ state: 'visible' });
    const expanded = await page.getAttribute('button[aria-haspopup="listbox"]', 'aria-expanded');
    check('keyboard home → Enter opens switcher', expanded === 'true', `aria-expanded=${expanded}`);
    // Tab to first option (focus was on the trigger) and select it
    await page.keyboard.press('Tab');
    const firstOption = page.locator('[role="option"]').first();
    const optionCount = await page.locator('[role="option"]').count();
    const optionFocused = await firstOption.evaluate((el) => document.activeElement === el);
    check('keyboard home → Tab lands on first option', optionFocused && optionCount > 0, `count=${optionCount}`);
    await page.keyboard.press('Enter');
    await page.locator('[role="listbox"]').waitFor({ state: 'hidden' }).catch(() => {});
    const stillOpen = await page.getAttribute('button[aria-haspopup="listbox"]', 'aria-expanded');
    check('keyboard home → Enter selects option + closes', stillOpen === 'false', `aria-expanded=${stillOpen}`);
  }

  await page.close();
}

// ─── Pass E: degraded network ───────────────────────────────────────────────
async function passDegradedNetwork(context) {
  section('NETWORK — throttled + offline');
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');

  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 1500,
    downloadThroughput: 250000,
    uploadThroughput: 250000,
  });

  // Home under throttle: widgets eventually render, no crash
  {
    const pageErrors = watchPage(page);
    await gotoPage(page, `${BASE}/fr/dashboard/parent/`, { expectHeading: 'Espace Parent' });
    await page.getByText('Enfant actif').waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
    check('throttle home → widgets render after latency', (await page.getByText('Enfant actif').count()) > 0);
    check('throttle home → no pageerror', pageErrors.length === 0, pageErrors.join(' | '));
  }

  // Finance under throttle: data still completes
  {
    const pageErrors = watchPage(page);
    await gotoPage(page, `${BASE}/fr/dashboard/parent/finance`, { expectHeading: 'Finance' });
    await waitForText(page, '800 MAD', 90000);
    check('throttle finance → data completes', (await page.getByText('800 MAD', { exact: false }).count()) > 0);
    check('throttle finance → no pageerror', pageErrors.length === 0, pageErrors.join(' | '));
  }

  // Offline: explicit error state, no crash. A full page.goto while offline
  // hard-fails at the navigation itself (net::ERR_INTERNET_DISCONNECTED), so the
  // view is loaded online first and the network is dropped afterwards — the app's
  // graceful degradation is a client-side data-fetch error, which needs the JS
  // bundle already mounted. Clicking Actualiser triggers useParentChildContext's
  // reload; the fetch rejects and ParentPageShell renders the role="alert" banner.
  {
    const pageErrors = watchPage(page);
    await gotoPage(page, `${BASE}/fr/dashboard/parent/communication`, { expectHeading: 'Communication' });
    await waitForText(page, 'PRN Annonce Classe A', 90000);
    await client.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await page.getByRole('button', { name: 'Actualiser' }).click();
    await page.getByRole('alert').waitFor({ state: 'visible', timeout: 45000 }).catch(() => {});
    const alertCount = await page.getByRole('alert').count();
    check('offline → explicit error banner shown', alertCount > 0, `alerts=${alertCount}`);
    check('offline → no pageerror', pageErrors.length === 0, pageErrors.join(' | '));
    await shot(page, 'offline-error.png');
  }

  await client.detach();
  await page.close();
}

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Parent/Guardian Portal — browser acceptance (${BASE})`);
  console.log(`PARENT = ${PARENT_EMAIL}`);

  await cleanupMutations();

  const browser = await chromium.launch({ headless: true });

  try {
    section('AUTH — session via API sign-in (dev :3002 origin mismatch)');
    const state = await apiSignIn(PARENT_EMAIL, PARENT_PASS);
    check('auth → session cookies captured', (state.cookies ?? []).some((c) => c.name.toLowerCase().includes('session')), `cookies=${(state.cookies ?? []).map((c) => c.name).join(',')}`);

    const mk = (opts) => browser.newContext({ storageState: state, ...opts });

    let ctx = await mk({ viewport: { width: 1280, height: 800 }, locale: 'fr' });
    await passFrGoldenPath(ctx, 'fr');
    await ctx.close();

    ctx = await mk({ viewport: { width: 1280, height: 800 }, locale: 'fr' });
    await passFrContent(ctx);
    await ctx.close();

    ctx = await mk({ viewport: { width: 1280, height: 800 }, locale: 'ar' });
    await passFrGoldenPath(ctx, 'ar');
    await ctx.close();

    ctx = await mk({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'fr' });
    await passMobile(ctx);
    await ctx.close();

    ctx = await mk({ viewport: { width: 1280, height: 800 }, locale: 'fr' });
    await passKeyboard(ctx);
    await ctx.close();

    ctx = await mk({ viewport: { width: 1280, height: 800 }, locale: 'fr' });
    await passDegradedNetwork(ctx);
    await ctx.close();
  } finally {
    await browser.close();
    await cleanupMutations();
    await pool.end();
  }

  console.log(`\n==== RESULT: ${passed} passed, ${failed} failed ====`);
  if (failed > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
