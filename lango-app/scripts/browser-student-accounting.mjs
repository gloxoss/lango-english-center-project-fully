// Browser acceptance for Student Accounting build (#12). Verifies the four new
// server-guarded pages render for an accountant and that a parent role is
// redirected. Run against the live dev server (:3002).
// Run: node scripts/browser-student-accounting.mjs
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

const PAGES = [
  { path: '/fr/dashboard/finance/fee-types', h1: 'Types de frais', action: 'Créer un type de frais' },
  { path: '/fr/dashboard/finance/fine-policies', h1: 'Politiques d\'amendes', action: 'Lancer l\'évaluation' },
  { path: '/fr/dashboard/finance/fee-structures', h1: 'Structures de frais', action: 'Versions' },
  { path: '/fr/dashboard/settings/payment-methods', h1: 'Méthodes de paiement', action: 'Nouvelle méthode' },
];

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const accState = await apiSignIn(ACCOUNTANT_EMAIL, ACCOUNTANT_PASSWORD);
    const ctx = await browser.newContext({ storageState: accState });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));

    for (const p of PAGES) {
      const label = p.path.split('/').pop();
      const resp = await page.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      check(`${label}: page loads (200)`, resp?.status() === 200, `status=${resp?.status()}`);

      await page.getByRole('heading', { level: 1, name: p.h1 }).first().waitFor({ state: 'visible', timeout: 60000 });
      check(`${label}: h1 "${p.h1}" rendered`, true);

      try {
        await page.getByText(p.action, { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
        check(`${label}: "${p.action}" present`, true);
      } catch {
        // action element may be role-gated off; page must still render the table/empty state
        check(`${label}: "${p.action}" present`, false, 'not found in DOM');
      }
    }
    check('accountant: no uncaught page errors across pages', pageErrors.length === 0, pageErrors.join(' | '));

    // ── Parent role redirected from guarded pages ──
    const parState = await apiSignIn(PARENT_EMAIL, PARENT_PASSWORD);
    const pctx = await browser.newContext({ storageState: parState });
    const ppage = await pctx.newPage();
    for (const p of PAGES) {
      const label = p.path.split('/').pop();
      await ppage.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await ppage.waitForTimeout(1500);
      const url = ppage.url();
      const needle = p.path.split('/').slice(3).join('/'); // e.g. finance/fee-types
      const redirected = !url.includes(needle);
      check(`parent redirected from ${label}`, redirected, `final=${url}`);
    }

    console.log(`\n==== ${passed} passed, ${failed} failed ====`);
    if (failures.length) {
      console.log('Failed:');
      for (const f of failures) console.log(`  - ${f}`);
    }
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
};

run().catch((err) => {
  console.error('Browser run crashed:', err.message);
  process.exit(1);
});
