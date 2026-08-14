// Browser acceptance for the Accountant Portal cleanup (#14).
// Verifies /dashboard/accountant and /dashboard/finance/reminders render real
// finance data for an accountant and that a parent role is redirected.
// Run against the live dev server (:3002).
// Run: node scripts/browser-accountant-portal.mjs
import { chromium } from 'playwright';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const ACCOUNTANT_EMAIL = 'accountant@atlas.ma';
const ACCOUNTANT_PASSWORD = 'Admin123!';
const PARENT_EMAIL = 'prn-prn-parent-a@placeholder.local';
const PARENT_PASSWORD = 'ParentAdmin123!';

let passed = 0;
let failed = 0;
const failures = [];
function check(name, ok, extra = '') {
  if (ok) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; failures.push(name); console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
}

async function apiSignIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
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
      name, value, domain: new URL(BASE).hostname, path: attrs.path || '/',
      httpOnly: !!attrs.httponly, secure: !!attrs.secure,
      sameSite: sameSite === 'none' ? 'None' : sameSite === 'strict' ? 'Strict' : 'Lax',
    };
  });
  return { cookies, origins: [] };
}

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // ── Accountant session ──
    const accState = await apiSignIn(ACCOUNTANT_EMAIL, ACCOUNTANT_PASSWORD);
    const ctx = await browser.newContext({ storageState: accState });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));

    const resp = await page.goto(`${BASE}/fr/dashboard/accountant`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    check('accountant page loads (200)', resp?.status() === 200, `status=${resp?.status()}`);

    await page.getByRole('heading', { level: 1, name: 'Portail comptable' }).first().waitFor({ state: 'visible', timeout: 60000 });
    check('h1 "Portail comptable" rendered', true);

    await page.getByText('Espèces aujourd’hui', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('KPI card "Espèces aujourd’hui" present', true);
    await page.getByText('Encaissements en ligne', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('KPI card "Encaissements en ligne" present', true);
    await page.getByText('Factures en attente', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('KPI card "Factures en attente" present', true);

    await page.getByText('INV-2026-0002', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('recent-invoices table shows real INV-2026-0002', true);
    await page.getByText('Salma Bennani', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('recent-invoices table shows real student Salma Bennani', true);

    // Reminders page
    const respRem = await page.goto(`${BASE}/fr/dashboard/finance/reminders`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    check('reminders page loads (200)', respRem?.status() === 200, `status=${respRem?.status()}`);
    await page.getByRole('heading', { level: 1, name: 'Reçus, rappels & relevés' }).first().waitFor({ state: 'visible', timeout: 60000 });
    check('h1 "Reçus, rappels & relevés" rendered', true);
    await page.getByText('Factures en retard de paiement', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('overdue-invoices table present', true);
    await page.getByText('INV-2026-0002', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('overdue list shows real INV-2026-0002', true);
    await page.getByText('Envoyer un rappel', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('"Envoyer un rappel" action present', true);

    check('no pageerror on accountant pages', pageErrors.length === 0, pageErrors.join(' | '));
    await ctx.close();

    // ── Parent session: role guard redirects both pages ──
    const parState = await apiSignIn(PARENT_EMAIL, PARENT_PASSWORD);
    const ctx2 = await browser.newContext({ storageState: parState });
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/fr/dashboard/accountant`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p2.waitForTimeout(3000);
    const url2 = p2.url();
    check('parent redirected away from accountant page', !url2.includes('/dashboard/accountant'), `url=${url2}`);

    await p2.goto(`${BASE}/fr/dashboard/finance/reminders`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p2.waitForTimeout(3000);
    const url3 = p2.url();
    check('parent redirected away from reminders page', !url3.includes('/dashboard/finance/reminders'), `url=${url3}`);
    await ctx2.close();
  } finally {
    await browser.close();
  }

  console.log(`\n==== ${passed}/${passed + failed} passed, ${failed} failed ====`);
  if (failures.length) { console.log('Failed:', failures.join(' | ')); process.exit(1); }
};

run().catch((err) => { console.error('FATAL', err.message); process.exit(1); });
