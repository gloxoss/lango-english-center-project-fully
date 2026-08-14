// browser-subscriptions.mjs — browser render check for the subscription pages
// (plan #4). Signs in via node fetch (Origin :3000), injects the session cookie
// into a Playwright context and asserts the three pages render with real rows:
//   1. /fr/dashboard/super-admin/subscriptions      (Plans & Modules)
//   2. /fr/dashboard/super-admin/subscriptions/list (Gestion des Abonnements)
//   3. /fr/dashboard/settings/subscription          (school-facing, Atlas)
// A pending renewal request is created beforehand so the school page shows a
// real payment row; it is cleaned up at the end.
// Run: node scripts/browser-subscriptions.mjs  (dev server must be on :3002)
import { Pool } from 'pg';
import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const SUPER = { email: 'superadmin@schoolos.ma', password: 'Admin123!' };
const ADMIN = { email: 'admin2@atlas.ma', password: 'Admin123!' };
const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';

let passed = 0;
let failed = 0;
const failures = [];
function check(name, ok, extra = '') {
  if (ok) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; failures.push(name); console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
}

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}
loadLocalEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos' });

class Jar {
  constructor() { this.cookies = new Map(); }
  setFrom(res) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const eq = pair.indexOf('=');
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  list() { return [...this.cookies.entries()].map(([name, value]) => ({ name, value })); }
}

async function signIn(jar, email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  jar.setFrom(res);
  return res.status;
}

async function req(jar, method, pathStr, body) {
  const res = await fetch(`${BASE}${pathStr}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: jar.list().map(c => `${c.name}=${c.value}`).join('; ') },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, text };
}

// ─── super-admin 2FA enrollment (RFC 6238) ──────────────────────────────────
// The dashboard layout forces mandatory 2FA enrollment for super_admin, so the
// two super-admin pages below would land on the enroll screen. Enroll the
// superadmin through the real Better Auth flow (enable -> TOTP -> verify-totp)
// using the API session; this flips user.two_factor_enabled and the layout gate
// then passes. Cleaned up at the end.
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
async function postAuth(jar, pathStr, body) {
  const res = await fetch(`${BASE}${pathStr}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: jar.list().map(c => `${c.name}=${c.value}`).join('; ') },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
  jar.setFrom(res);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, text };
}
async function enrollSuperAdmin(jar) {
  const en = await postAuth(jar, '/api/auth/two-factor/enable', { password: SUPER.password });
  if (en.status !== 200 || !en.json?.totpURI) {
    console.log(`    [2fa] enable ${en.status}: ${en.text?.slice(0, 160)}`);
    return false;
  }
  const secret = en.json.totpURI.match(/secret=([^&]+)/)?.[1] ?? null;
  if (!secret) return false;
  const vf = await postAuth(jar, '/api/auth/two-factor/verify-totp', { code: totp(secret) });
  if (vf.status !== 200) {
    console.log(`    [2fa] verify-totp ${vf.status}: ${vf.text?.slice(0, 160)}`);
    return false;
  }
  return true;
}
async function resetSuperTwoFactor() {
  await pool.query(`DELETE FROM two_factor WHERE user_id = (SELECT id FROM "user" WHERE email = $1)`, [SUPER.email]);
  await pool.query(`UPDATE "user" SET two_factor_enabled = false WHERE email = $1`, [SUPER.email]);
}
async function waitVisible(page, selector, timeout = 30000) {
  return page.waitForSelector(selector, { state: 'visible', timeout }).then(() => true).catch(() => false);
}

async function run() {
  console.log('Subscription pages browser render check');
  console.log('=========================================\n');

  // Seed: create a pending renewal request for Atlas so the school page has a real row.
  const adminJar = new Jar();
  await signIn(adminJar, ADMIN.email, ADMIN.password);
  const seed = await req(adminJar, 'POST', '/api/settings/subscription/renewal-request', { months: 12, note: 'Browser check' });
  const seededPaymentId = seed.json?.data?.id;
  check(`seed pending request ${seed.status}`, seed.status === 201 && seededPaymentId, seed.text?.slice(0, 120));

  const outDir = path.resolve('future-implementation/subscription-licensing/.implementation-plan/browser-evidence');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();

  // ---- Super-admin pages ----
  await resetSuperTwoFactor(); // clean slate: superadmin always faces mandatory 2FA
  const superJar = new Jar();
  const sStatus = await signIn(superJar, SUPER.email, SUPER.password);
  check(`superadmin sign-in ${sStatus}`, sStatus === 200, `got ${sStatus}`);
  const enrolled = await enrollSuperAdmin(superJar);
  check('superadmin 2FA enrolled (dashboard gate passes)', enrolled, 'enable/verify-totp failed');
  const superCookies = superJar.list();
  const ctx1 = await browser.newContext();
  await ctx1.addCookies(superCookies.map(c => ({ name: c.name, value: c.value, domain: 'localhost', path: '/' })));
  const page1 = await ctx1.newPage();

  await page1.goto(`${BASE}/fr/dashboard/super-admin/subscriptions`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  check('SA1. "Plans & Modules" h1 renders', await waitVisible(page1, 'h1:has-text("Plans & Modules")'));
  check('SA2. catalog lists multi-branch module', await waitVisible(page1, 'text=Multi-Succursales'));
  await page1.screenshot({ path: path.join(outDir, 'super-admin-subscriptions.png'), fullPage: false });

  await page1.goto(`${BASE}/fr/dashboard/super-admin/subscriptions/list`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  check('SA3. "Gestion des Abonnements" h1 renders', await waitVisible(page1, 'h1:has-text("Gestion des Abonnements")'));
  check('SA4. Atlas row visible', await waitVisible(page1, 'text=Atlas'));
  await page1.screenshot({ path: path.join(outDir, 'super-admin-subscriptions-list.png'), fullPage: false });

  // ---- School-facing page ----
  const adminCookies = adminJar.list();
  const ctx2 = await browser.newContext();
  await ctx2.addCookies(adminCookies.map(c => ({ name: c.name, value: c.value, domain: 'localhost', path: '/' })));
  const page2 = await ctx2.newPage();

  await page2.goto(`${BASE}/fr/dashboard/settings/subscription`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page2.waitForTimeout(4000);
  const h1c = await page2.locator('h1').allTextContents().catch(() => []);
  check('SC1. "Abonnement & Licence" h1 renders', h1c.some(t => t.trim() === 'Abonnement & Licence'), h1c.join(' | '));
  const renewBtn = await page2.locator('button:has-text("Demander le renouvellement")').count();
  check('SC2. renew button present', renewBtn > 0);
  const payText = await page2.locator('text=Historique des paiements').count();
  check('SC3. payment history section present', payText > 0);
  // The KPI band has a static "Demandes en attente" label that matches the same
  // text, so scope the wait to the payments table body — the seeded pending row
  // is newest-first (row 1) and renders an "En attente" status badge there.
  const pendingRow = await page2.locator('tbody').getByText('En attente').first()
    .waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
  check('SC4. pending payment row badge visible', pendingRow, 'no "En attente" row in payments table');
  await page2.screenshot({ path: path.join(outDir, 'school-subscription.png'), fullPage: false });

  // ---- Renewal dialog interaction ----
  await page2.locator('button:has-text("Demander le renouvellement")').first().click();
  await page2.waitForTimeout(800);
  const dialogText = await page2.locator('body').innerText().catch(() => '');
  check('SC5. renewal dialog opens', dialogText.includes('Durée de la prolongation'), 'dialog text missing');
  await page2.locator('button:has-text("Envoyer la demande")').click();
  await page2.waitForTimeout(2500);
  const body3 = await page2.locator('body').innerText().catch(() => '');
  check('SC6. request submission confirmation shown', body3.includes('Demande de renouvellement') && body3.includes('envoyée'), 'no confirmation');
  await page2.screenshot({ path: path.join(outDir, 'school-subscription-dialog.png'), fullPage: false });

  await browser.close();

  // Cleanup: remove the seeded + dialog-created pending payments and any license rows.
  const del = await pool.query(
    `DELETE FROM license_payments WHERE tenant_id = $1 AND status = 'pending' AND created_at > now() - interval '10 minutes'`,
    [ATLAS],
  );
  check(`cleanup — removed ${del.rowCount} pending payment(s)`, del.rowCount >= 1, 'nothing to clean');
  await pool.query('DELETE FROM school_licenses WHERE tenant_id = $1', [ATLAS]).catch(() => {});
  // Restore the superadmin 2FA state enrolled above (self-cleaning).
  await resetSuperTwoFactor();

  await pool.end();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) { console.log('Failures:', failures.join(' | ')); process.exit(1); }
}

run().catch(err => { console.error(err); process.exit(1); });
