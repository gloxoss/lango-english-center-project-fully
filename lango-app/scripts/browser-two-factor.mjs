// Browser acceptance pass for Two-Factor Authentication (plan #3).
// Drives the LIVE dev server (:3002, Postgres schoolos-db) in real Chromium via
// `playwright`. Proves, in the actual UI:
//   A. super_admin is ALWAYS blocked by the mandatory enroll screen; clicking
//      through renders a real QR (qrcode.react svg) — then returns.
//   B. school_admin is NOT blocked while the tenant toggle is off, the
//      "Obligation 2FA administrateurs" switch on /settings/security flips
//      enforcement live (PATCH -> setting_values row), and turning it on
//      immediately blocks school_admin on /dashboard.
//   C. school_admin enrolls THROUGH the blocked screen (password -> QR -> real
//      TOTP -> backup codes -> dashboard), then uses the settings switch to
//      turn enforcement OFF again (DB row removed).
// Self-cleans all mutations (two_factor rows, otp rows, setting row).
//
// Run:  node scripts/browser-two-factor.mjs
// Env:  VERIFY_BASE (default http://localhost:3002), DATABASE_URL
//
// NOTE on dev origin: the app runs on :3002 while Better Auth's baseURL is
// :3000, so in-browser POSTs to /api/auth/** are rejected INVALID_ORIGIN (they
// are same-origin in production). We rewrite the Origin header on intercepted
// /api/auth/** requests — the honest equivalent of the prod same-origin setup.

import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const AUTH_ORIGIN = 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos';

const SUPER = { email: 'superadmin@schoolos.ma', password: 'Admin123!' };
const ADMIN = { email: 'admin2@atlas.ma', password: 'Admin123!' };
const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';

const ENROLL_HEADING = 'Sécurisez votre compte';
const SHELL_HEADING = 'Tableau de bord Établissement';
const SETTING_KEY = 'security.requireTwoFactorForAdmins';
const EVIDENCE_DIR = path.join(ROOT, 'future-implementation', 'two-factor-authentication', '.implementation-plan', 'browser-evidence');
mkdirSync(EVIDENCE_DIR, { recursive: true });

const pool = new pg.Pool({ connectionString: DB_URL, max: 3 });

// ─── harness ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];
function check(name, ok, extra = '') {
  if (ok) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; failures.push(name); console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
}
function section(title) { console.log(`\n== ${title}`); }
function watchPage(page) {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));
  return pageErrors;
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, name), fullPage: false });
}
// On a cold Turbopack start the page can render before React hydration, and a
// fill() then gets wiped when hydration resets the controlled input. The only
// reliable signal that the fill took effect is the submit button becoming
// enabled (disabled={... || !value}), so loop: fill -> re-assert -> check the
// button. Each retry after hydration completes fires React's onChange and the
// state sticks. Throw with a clear message if the button never enables.
async function fillRobust(page, locator, value, submitButtonName) {
  const input = page.locator(locator);
  await input.waitFor({ state: 'visible', timeout: 60000 });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await input.fill(value);
    await page.waitForTimeout(200);
    const enabled = await page.waitForFunction((name) => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(name));
      return !!btn && !btn.disabled;
    }, submitButtonName, { timeout: 1500 }).then(() => true).catch(() => false);
    if (enabled) return;
  }
  throw new Error(`fillRobust: "${submitButtonName}" never enabled after filling ${locator} (value=${JSON.stringify(value)})`);
}

// The enroll screen can server-render before its client JS hydrates; a fill that
// lands pre-hydration fires onChange on an input with no React listener, so the
// submit button never enables. Probe hydration deterministically by waiting for
// React to attach its props to the password input (only happens on hydration).
async function waitEnrollHydrated(page, { timeout = 45000 } = {}) {
  await page.waitForFunction(() => {
    const input = document.querySelector('input[placeholder="••••••••"]');
    return !!input && Object.keys(input).some((k) => k.startsWith('__reactProps$'));
  }, { timeout }).catch(() => false);
}

// Dev-server Turbopack compiles routes on demand, so a heading can be slow to
// appear right after a prior section's client work. Retry with one reload.
async function waitForHeadingSafe(page, name, { timeout = 60000, retries = 1 } = {}) {
  for (let i = 0; i <= retries; i += 1) {
    try {
      await page.getByRole('heading', { name }).first().waitFor({ state: 'visible', timeout });
      return true;
    } catch (err) {
      if (i < retries) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
      } else {
        return false;
      }
    }
  }
  return false;
}

// ─── auth session via API (Origin spoof, same convention as other suites) ───
async function apiSignIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: AUTH_ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`sign-in for ${email} failed (${res.status}): ${await res.text()}`);
  const cookies = (res.headers.getSetCookie?.() ?? []).map((raw) => {
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
      name, value,
      domain: new URL(BASE).hostname,
      path: attrs.path || '/',
      httpOnly: !!attrs.httponly,
      secure: !!attrs.secure,
      sameSite: sameSite === 'none' ? 'None' : sameSite === 'strict' ? 'Strict' : 'Lax',
    };
  });
  return { cookies, origins: [] };
}

// ─── RFC 6238 TOTP ──────────────────────────────────────────────────────────
function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...str.toUpperCase().replace(/=+$/, '')].map(c => alphabet.indexOf(c)).filter(i => i >= 0)
    .map(i => i.toString(2).padStart(5, '0')).join('');
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function totp(secretBase32) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(buf).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff);
  return (bin % 10 ** 6).toString().padStart(6, '0');
}

// ─── route interceptor: rewrite Origin for /api/auth/** and capture the
//     two-factor enable secret so the UI flow can be completed with a real code.
// Every /api/auth request is re-issued with `route.fetch({ headers })` (a
// server-side fetch that sends the exact overridden headers) and the response
// relayed with `route.fulfill`. `route.continue` would be cheaper, but Chromium
// silently drops an `Origin` override there — observed as Better Auth returning
// 403 INVALID_ORIGIN with the :3002 origin on verify-totp.
async function installAuthOriginRewrite(context) {
  const capture = { secret: null, uri: null };
  await context.route('**/api/auth/**', async (route) => {
    const req = route.request();
    const headers = { ...req.headers() };
    headers.origin = AUTH_ORIGIN;
    const resp = await route.fetch({ headers });
    if (req.url().endsWith('/api/auth/two-factor/enable')) {
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        if (json.totpURI) {
          capture.uri = json.totpURI;
          capture.secret = json.totpURI.match(/secret=([^&]+)/)?.[1] ?? null;
        }
      } catch { /* keep the raw response */ }
    }
    await route.fulfill({ response: resp });
  });
  return capture;
}

// ─── db helpers ─────────────────────────────────────────────────────────────
// setSettingValue() is an upsert that never deletes the row — value=false leaves
// a row with value=false — so assertions must read the actual boolean, not the
// row count.
async function settingValue(tenantId, key) {
  const r = await pool.query(`select value from setting_values where tenant_id = $1 and key = $2`, [tenantId, key]);
  return r.rows[0]?.value ?? null;
}
async function settingCount(tenantId, key) {
  const r = await pool.query(`select count(*)::int c from setting_values where tenant_id = $1 and key = $2`, [tenantId, key]);
  return r.rows[0].c;
}
// The security page is a heavy client component; on a cold Turbopack load the
// switch renders before React hydration attaches its onClick, so a pre-hydration
// click is silently dropped (no fetch, no state change). Poll the click until
// aria-checked actually flips (the proof the handler ran), with a settle window
// long enough for React to commit the re-render before the next read.
async function clickToggleRobust(page, sw) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const before = await sw.getAttribute('aria-checked');
    await sw.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const after = await sw.getAttribute('aria-checked');
    if (before !== after) return after;
  }
  throw new Error('clickToggleRobust: switch never responded to a click (hydration did not attach onClick)');
}
async function waitForDb(pred, timeoutMs = 15000, label = 'db') {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pred()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}
async function dbCleanup() {
  for (const email of [SUPER.email, ADMIN.email]) {
    const uidRes = await pool.query(`select id from "user" where email = $1`, [email]);
    const uid = uidRes.rows[0]?.id;
    if (uid) {
      await pool.query(`delete from two_factor_otps where user_id = $1`, [uid]);
      await pool.query(`delete from two_factor where user_id = $1`, [uid]);
      await pool.query(`update "user" set two_factor_enabled = false where id = $1`, [uid]);
    }
  }
  for (const t of [ATLAS, LANGO]) {
    await pool.query(`delete from setting_values where tenant_id = $1 and key = $2`, [t, SETTING_KEY]);
  }
}

// ─── A. super_admin mandatory enroll screen + QR render ────────────────────
async function passSuperAdminMandatory(ctx) {
  section('A — super_admin mandatory enroll screen (UI)');
  const page = await ctx.newPage();
  const pageErrors = watchPage(page);

  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('heading', { name: ENROLL_HEADING }).waitFor({ state: 'visible', timeout: 60000 });
  check('A1: super_admin lands on mandatory enroll screen', true);

  const pw = page.getByPlaceholder('••••••••');
  check('A2: password field + "Générer le code QR" button present',
    (await pw.count()) > 0 && (await page.getByRole('button', { name: 'Générer le code QR' }).count()) > 0);
  await waitEnrollHydrated(page);

  await fillRobust(page, 'input[placeholder="••••••••"]', SUPER.password, 'Générer le code QR');
  await page.getByRole('button', { name: 'Générer le code QR' }).click();
  // QR step is signalled by the code input; the QR itself is an <svg> with
  // <rect>s (lucide icons are svg-with-path, so `svg rect` is the QR).
  await page.getByPlaceholder('123456').waitFor({ state: 'visible', timeout: 30000 });
  check('A3: QR step renders a real QR svg (qrcode.react)', (await page.locator('svg rect').count()) > 0);
  check('A4: "Code de vérification" input shown on QR step', true);
  await shot(page, 'A-superadmin-enroll-qr.png');

  await page.getByRole('button', { name: 'Retour' }).click();
  check('A5: "Retour" returns to password step', (await pw.count()) > 0);
  check('A6: no page errors on enroll screen', pageErrors.length === 0, pageErrors.join(' | '));
  await page.close();
}

// ─── B. school_admin: toggle off (shell) -> toggle ON live -> blocked ──────
async function passToggleAndBlock(ctx) {
  section('B — school_admin enforcement toggle (settings UI)');
  const page = await ctx.newPage();
  const pageErrors = watchPage(page);

  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  check('B1: school_admin reaches dashboard shell while toggle off', await waitForHeadingSafe(page, SHELL_HEADING));
  check('B1b: no enroll screen while toggle off', (await page.getByRole('heading', { name: ENROLL_HEADING }).count()) === 0);

  await page.goto(`${BASE}/fr/dashboard/settings/security`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const sw = page.getByRole('switch', { name: 'Obligation 2FA administrateurs' });
  await sw.waitFor({ state: 'visible', timeout: 60000 });
  check('B2: "Obligation 2FA administrateurs" switch rendered', true);
  check('B2b: switch starts OFF', (await sw.getAttribute('aria-checked')) === 'false', `checked=${await sw.getAttribute('aria-checked')}`);

  await clickToggleRobust(page, sw);
  const onInDb = await waitForDb(async () => (await settingValue(ATLAS, SETTING_KEY)) === true, 30000);
  check('B3: switch ON -> setting_values value=true', onInDb);
  check('B3b: switch now shows ON', (await sw.getAttribute('aria-checked')) === 'true', `checked=${await sw.getAttribute('aria-checked')}`);
  await shot(page, 'B-toggle-on.png');

  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  check('B4: school_admin now blocked by enforce screen (toggle ON)', await waitForHeadingSafe(page, ENROLL_HEADING));
  check('B4b: no page errors', pageErrors.length === 0, pageErrors.join(' | '));
  return page; // stay on the enroll screen so pass C can enroll through it
}

// ─── C. enroll THROUGH the blocked screen, then toggle OFF via UI ──────────
async function passEnrollThroughBlocked(page, ctx, capture) {
  section('C — school_admin enrolls through the blocked screen, then un-enforces');
  // Fresh navigation so the enforce screen gets a clean hydration attempt — a
  // page carried over from a prior navigation can stay pre-hydration and frozen.
  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  check('C0: school_admin still blocked after fresh navigation', await waitForHeadingSafe(page, ENROLL_HEADING));
  await waitEnrollHydrated(page);
  await fillRobust(page, 'input[placeholder="••••••••"]', ADMIN.password, 'Générer le code QR');
  await page.getByRole('button', { name: 'Générer le code QR' }).click();
  await page.getByPlaceholder('123456').waitFor({ state: 'visible', timeout: 30000 });
  check('C1: blocked screen advances to QR step', (await page.locator('svg rect').count()) > 0);
  check('C1b: totp secret captured from /two-factor/enable response', !!capture.secret, `secret=${capture.secret ?? 'none'}`);
  await shot(page, 'C-admin2-enroll-qr.png');

  const code = capture.secret ? totp(capture.secret) : '000000';
  await fillRobust(page, 'input[placeholder="123456"]', code, 'Vérifier et activer');
  await page.getByRole('button', { name: 'Vérifier et activer' }).click();
  await page.getByText('Conservez ces codes de secours').first().waitFor({ state: 'visible', timeout: 30000 });
  check('C2: backup-codes step reached after valid TOTP', true);
  await shot(page, 'C-backup-codes.png');

  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Accéder au tableau de bord' }).click();
  check('C3: enrolled school_admin reaches dashboard shell', await waitForHeadingSafe(page, SHELL_HEADING));
  const tfaDb = await pool.query(`select two_factor_enabled from "user" where email = $1`, [ADMIN.email]);
  check('C3b: two_factor_enabled now true in DB', tfaDb.rows[0]?.two_factor_enabled === true, `=${tfaDb.rows[0]?.two_factor_enabled}`);

  // Settings switch still ON after enrollment -> flip it OFF through the UI.
  await page.goto(`${BASE}/fr/dashboard/settings/security`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const sw = page.getByRole('switch', { name: 'Obligation 2FA administrateurs' });
  await sw.waitFor({ state: 'visible', timeout: 60000 });
  check('C4: switch reflects ON (enforcement still on) after enrollment',
    (await sw.getAttribute('aria-checked')) === 'true', `checked=${await sw.getAttribute('aria-checked')}`);
  await clickToggleRobust(page, sw);
  const offInDb = await waitForDb(async () => (await settingValue(ATLAS, SETTING_KEY)) === false, 30000);
  check('C5: switch OFF via UI -> setting_values value=false', offInDb);
  check('C5b: switch now shows OFF', (await sw.getAttribute('aria-checked')) === 'false', `checked=${await sw.getAttribute('aria-checked')}`);

  // Sanity: fresh admin2 session now unblocked (toggle off again).
  const fresh = await ctx.newPage();
  await fresh.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  check('C6: fresh school_admin session unblocked after toggle OFF', await waitForHeadingSafe(fresh, SHELL_HEADING));
  await fresh.close();

  await page.close();
}

// ─── run ────────────────────────────────────────────────────────────────────
async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    section('AUTH — sessions via API sign-in (dev :3002 origin mismatch)');
    const superState = await apiSignIn(SUPER.email, SUPER.password);
    const adminState = await apiSignIn(ADMIN.email, ADMIN.password);
    check('auth → superadmin session cookies captured', (superState.cookies ?? []).some((c) => c.name.toLowerCase().includes('session')));
    check('auth → school_admin session cookies captured', (adminState.cookies ?? []).some((c) => c.name.toLowerCase().includes('session')));

    const superCtx = await browser.newContext({ storageState: superState, viewport: { width: 1280, height: 800 } });
    await installAuthOriginRewrite(superCtx);
    await passSuperAdminMandatory(superCtx);
    await superCtx.close();

    // Pre-warm the settings PATCH route so the browser's switch click in section
    // B hits a compiled route. On a cold Turbopack start the very first request
    // to /api/settings/values/[key] can fail under compile contention, which
    // reverts the optimistic toggle (observed B3 revert). A warm PATCH with the
    // same admin session (value=false = clean enforcement state) compiles the
    // route and proves the mechanism before the UI run.
    const warmRes = await fetch(`${BASE}/api/settings/values/${SETTING_KEY}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminState.cookies.map((c) => `${c.name}=${c.value}`).join('; '),
      },
      body: JSON.stringify({ value: false, reason: 'warm-up (clean state)' }),
    });
    check('warm-up: settings PATCH route compiles + enforcement OFF', warmRes.status === 200, `status=${warmRes.status}`);

    const adminCtx = await browser.newContext({ storageState: adminState, viewport: { width: 1280, height: 800 } });
    const capture = await installAuthOriginRewrite(adminCtx);
    const blockedPage = await passToggleAndBlock(adminCtx);
    await passEnrollThroughBlocked(blockedPage, adminCtx, capture);
    await adminCtx.close();

    console.log(`\n==== ${passed} passed, ${failed} failed ====`);
    if (failures.length) {
      console.log('Failed:');
      for (const f of failures) console.log(`  - ${f}`);
    }
  } finally {
    await browser.close();
    await dbCleanup();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Browser probe crashed:', err);
  process.exitCode = 1;
}).finally(() => { process.exitCode = failed ? 1 : process.exitCode ?? 0; });
