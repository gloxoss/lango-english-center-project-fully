// Sidebar nav probe for the four new student-accounting pages (#12). Confirms
// the server-owned manifest nav (accountant) and the hardcoded school nav
// (school_admin) both expose: Structures de frais, Types de frais, Politiques
// d'amendes (finance group) and Méthodes de paiement (finance/settings).
// Run: node scripts/sidebar-nav-probe.mjs
import { chromium } from 'playwright';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const ACCOUNTANT_EMAIL = 'accountant@atlas.ma';
const ACCOUNTANT_PASSWORD = 'Admin123!';
const ADMIN_EMAIL = 'admin2@atlas.ma';
const ADMIN_PASSWORD = 'Admin123!';

const NEW_LABELS = [
  'Structures de frais',
  'Types de frais',
  'Politiques d\'amendes',
  'Méthodes de paiement',
];

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

async function sidebarTexts(page, marker) {
  await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 60000 });
  // Wait until the client sidebar hydrates and populates (marker = a gated
  // label that must appear once myPermissions/manifest resolve).
  const aside = page.locator('aside').first();
  await aside.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction((m) => {
    const el = document.querySelector('aside');
    return !!el && (!m || el.innerText.includes(m));
  }, marker, { timeout: 15000 });
  return aside.innerText();
}

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // ── Accountant (manifest nav) ──
    const accState = await apiSignIn(ACCOUNTANT_EMAIL, ACCOUNTANT_PASSWORD);
    const ctx = await browser.newContext({ storageState: accState });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/fr/dashboard/finance/fee-types`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    let text = await sidebarTexts(page, 'Finances');
    check('accountant: fee-types page auto-opens Finance submenu', text.includes('Finances') && text.includes('Types de frais'), `hasFinance=${text.includes('Finances')}`);

    await page.goto(`${BASE}/fr/dashboard/finance/fine-policies`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    text = await sidebarTexts(page, 'Finances');
    check('accountant: fine-policies submenu auto-opens', text.includes('Politiques d\'amendes'));

    await page.goto(`${BASE}/fr/dashboard/finance/fee-structures`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    text = await sidebarTexts(page, 'Finances');
    check('accountant: fee-structures submenu auto-opens', text.includes('Structures de frais'));

    await page.goto(`${BASE}/fr/dashboard/settings/payment-methods`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    text = await sidebarTexts(page, 'Finances');
    check('accountant: payment-methods visible in finance group', text.includes('Méthodes de paiement'));

    // Expand the Finances group manually from the finance dashboard and confirm all 4.
    await page.goto(`${BASE}/fr/dashboard/finance`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 60000 });
    await page.locator('aside').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForFunction(() => {
      const el = document.querySelector('aside');
      return !!el && el.innerText.includes('Finances');
    }, undefined, { timeout: 15000 });
    const finToggler = page.locator('aside button', { hasText: 'Finances' });
    if (await finToggler.count()) await finToggler.first().click();
    await page.waitForFunction((labels) => {
      const el = document.querySelector('aside');
      return !!el && labels.every(l => el.innerText.includes(l));
    }, NEW_LABELS, { timeout: 15000 });
    text = await page.locator('aside').first().innerText();
    for (const label of NEW_LABELS) {
      check(`accountant: "${label}" present in expanded sidebar`, text.includes(label));
    }

    // ── school_admin (hardcoded nav) ──
    const admState = await apiSignIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    const actx = await browser.newContext({ storageState: admState });
    const apage = await actx.newPage();
    await apage.goto(`${BASE}/fr/dashboard/finance/fee-types`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await apage.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 60000 });
    await apage.locator('aside').first().waitFor({ state: 'visible', timeout: 15000 });
    await apage.waitForFunction(() => {
      const el = document.querySelector('aside');
      return !!el && el.innerText.includes('Élèves');
    }, undefined, { timeout: 15000 });
    await apage.waitForFunction(() => {
      const el = document.querySelector('aside');
      return !!el && el.innerText.includes('Types de frais');
    }, undefined, { timeout: 15000 });
    const atext = await apage.locator('aside').first().innerText();
    check('school_admin: fee-types visible in school nav', atext.includes('Types de frais'));

    await apage.goto(`${BASE}/fr/dashboard/settings/payment-methods`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await apage.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 60000 });
    await apage.waitForFunction(() => {
      const el = document.querySelector('aside');
      return !!el && el.innerText.includes('Méthodes de paiement');
    }, undefined, { timeout: 15000 });
    const atext2 = await apage.locator('aside').first().innerText();
    check('school_admin: payment-methods visible in settings nav', atext2.includes('Méthodes de paiement'));

    console.log(`\n==== ${passed} passed, ${failed} failed ====`);
    if (failures.length) {
      console.log('Failed:');
      for (const f of failures) console.log(`  - ${f}`);
    }
  } finally {
    await browser.close();
  }
  process.exitCode = failed ? 1 : 0;
};

run().catch((err) => {
  console.error('Probe crashed:', err.message);
  process.exitCode = 1;
});
