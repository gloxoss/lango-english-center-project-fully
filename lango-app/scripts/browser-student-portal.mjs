// Browser acceptance for the Student Self-Service Portal (#20).
// Verifies the /dashboard/student page renders real data for a student and that
// a non-student role is redirected. Run against the live dev server (:3002).
// Run: node scripts/browser-student-portal.mjs
import { chromium } from 'playwright';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const STUDENT_EMAIL = 'prn-prn-child-a@placeholder.local';
const STUDENT_PASSWORD = 'ParentAdmin123!';
const ADMIN_EMAIL = 'y.elamrani@atlas.ma';
const ADMIN_PASSWORD = 'Admin123!';

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
    // ── Student session ──
    const studentState = await apiSignIn(STUDENT_EMAIL, STUDENT_PASSWORD);
    const ctx = await browser.newContext({ storageState: studentState });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));

    const resp = await page.goto(`${BASE}/fr/dashboard/student`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    check('page loads (200)', resp?.status() === 200, `status=${resp?.status()}`);

    await page.getByRole('heading', { level: 1, name: 'Espace Élève' }).first().waitFor({ state: 'visible', timeout: 60000 });
    check('h1 "Espace Élève" rendered', true);

    await page.getByText('matière(s) au programme', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('widget "matière(s) au programme" present', true);
    await page.getByText('pointage(s) enregistré(s)', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('widget "pointage(s) enregistré(s)" present', true);

    // Placement + today's status alert (present on 2026-08-09)
    await page.getByText('2nde A', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('placement "2nde A" visible', true);
    await page.getByText('Présent', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('today status alert shows "Présent"', true);

    // Sidebar group
    await page.getByText('Espace Élève', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('sidebar shows "Espace Élève" nav group', true);

    // Mes présences tab: 3 records + summary
    await page.getByRole('button', { name: 'Mes présences' }).click();
    await page.getByText('Historique de présence', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('attendance tab renders (Historique de présence)', true);
    await page.getByText('En retard', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 });
    await page.getByText('Absent', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('attendance records show "En retard" + "Absent" statuses', true);
    await page.getByText('Excusé', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('attendance summary card present (Excusé row)', true);

    // Mes matières tab
    await page.getByRole('button', { name: 'Mes matières' }).click();
    await page.getByText('Matières au programme', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    await page.getByText('Fatima Zahra Idrissi', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('subjects tab shows Mathématiques teacher', true);

    check('no pageerror on student page', pageErrors.length === 0, pageErrors.join(' | '));
    await ctx.close();

    // ── Non-student session: role guard redirects ──
    const adminState = await apiSignIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    const ctx2 = await browser.newContext({ storageState: adminState });
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/fr/dashboard/student`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p2.waitForTimeout(3000);
    const url2 = p2.url();
    check('school_admin redirected away from student page', !url2.includes('/dashboard/student'), `url=${url2}`);
    await ctx2.close();
  } finally {
    await browser.close();
  }

  console.log(`\n==== ${passed}/${passed + failed} passed, ${failed} failed ====`);
  if (failures.length) { console.log('Failed:', failures.join(' | ')); process.exit(1); }
};

run().catch((err) => { console.error('FATAL', err.message); process.exit(1); });
