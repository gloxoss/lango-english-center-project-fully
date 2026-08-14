// Browser acceptance for the Teacher Self-Service Portal (#19).
// Verifies the /dashboard/teacher page renders real data for a teacher and that
// a non-teacher role is redirected. Run against the live dev server (:3002).
// Run: node scripts/browser-teacher-portal.mjs
import { chromium } from 'playwright';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const TEACHER_EMAIL = 'fz.idrissi@atlas.ma';
const ADMIN_EMAIL = 'y.elamrani@atlas.ma';
const PASSWORD = 'Admin123!';

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
    // ── Teacher session ──
    const teacherState = await apiSignIn(TEACHER_EMAIL, PASSWORD);
    const ctx = await browser.newContext({ storageState: teacherState });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));

    const resp = await page.goto(`${BASE}/fr/dashboard/teacher`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    check('page loads (200)', resp?.status() === 200, `status=${resp?.status()}`);

    // Heading + widgets
    await page.getByRole('heading', { level: 1, name: 'Espace Enseignant' }).first().waitFor({ state: 'visible', timeout: 60000 });
    check('h1 "Espace Enseignant" rendered', true);
    await page.getByText('classe(s) assignée(s)', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('widget "classe(s) assignée(s)" present', true);
    await page.getByText('élève(s) au total', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('widget "élève(s) au total" present', true);
    await page.getByText('2nde A', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('class "2nde A" visible in Mes classes', true);
    await page.getByText('Mathématiques', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('subject "Mathématiques" visible', true);

    // Sidebar: Espace Enseignant group
    await page.getByText('Espace Enseignant', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('sidebar shows "Espace Enseignant" nav group', true);

    // Tabs: switch to Emploi du temps
    await page.getByRole('button', { name: 'Emploi du temps' }).click();
    await page.getByText('Dimanche', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    check('timetable tab renders 7 day cards (Dimanche visible)', true);

    check('no pageerror on teacher page', pageErrors.length === 0, pageErrors.join(' | '));
    await ctx.close();

    // ── Non-teacher session: role guard redirects ──
    const adminState = await apiSignIn(ADMIN_EMAIL, PASSWORD);
    const ctx2 = await browser.newContext({ storageState: adminState });
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/fr/dashboard/teacher`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p2.waitForTimeout(3000);
    const url2 = p2.url();
    check('school_admin redirected away from teacher page', !url2.includes('/dashboard/teacher'), `url=${url2}`);
    await ctx2.close();
  } finally {
    await browser.close();
  }

  console.log(`\n==== ${passed}/${passed + failed} passed, ${failed} failed ====`);
  if (failures.length) { console.log('Failed:', failures.join(' | ')); process.exit(1); }
};

run().catch((err) => { console.error('FATAL', err.message); process.exit(1); });
