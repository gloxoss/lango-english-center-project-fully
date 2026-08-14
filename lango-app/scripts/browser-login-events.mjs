// browser-login-events.mjs — browser render check for the login-events page.
// Signs in as the Atlas school_admin via node fetch (Origin :3000), injects the
// session cookie into a Playwright context, opens /fr/dashboard/settings/security/
// login-events and asserts the KPI cards + table render with real rows.
// Run: node scripts/browser-login-events.mjs  (dev server must be on :3002)
import { Pool } from 'pg';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const ADMIN = { email: 'admin2@atlas.ma', password: 'Admin123!' };

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

async function signIn(jar) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password }),
    redirect: 'manual',
  });
  jar.setFrom(res);
  return res.status;
}

async function run() {
  console.log('Login-events page browser render check');
  console.log('========================================\n');

  // Generate a couple of events so the page has data (cleanup at the end).
  const jar = new Jar();
  const status = await signIn(jar);
  check(`sign-in status ${status}`, status === 200, `got ${status}`);
  const jar2 = new Jar();
  await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: ADMIN.email, password: 'WrongPassword!' }),
    redirect: 'manual',
  });
  const cookies = jar.list();
  check('session cookie captured', cookies.length > 0 && cookies.some(c => c.name.includes('session_token')), `got ${cookies.map(c => c.name).join(',')}`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies(cookies.map(c => ({ name: c.name, value: c.value, domain: 'localhost', path: '/' })));
  const page = await context.newPage();

  // The page is a client component; first hit cold-compiles. Give it time.
  await page.goto(`${BASE}/fr/dashboard/settings/security/login-events`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);

  const h1s = await page.locator('h1').allTextContents().catch(() => []);
  check('h1 renders "Journal de connexion"', h1s.some(t => t.trim() === 'Journal de connexion'), `got ${h1s.join(' | ')}`);

  // KPI cards (client fetches the API on mount).
  const attemptsText = await page.locator('text=Tentatives enregistrées').count();
  const failuresText = await page.locator('text=Échecs').count();
  const rateText = await page.locator('text=Taux de réussite').count();
  check('KPI cards present', attemptsText > 0 && failuresText > 0 && rateText > 0, `cards ${attemptsText}/${failuresText}/${rateText}`);

  // Wait for the fetched rows to render (the admin email should appear).
  await page.waitForSelector(`text=${ADMIN.email}`, { timeout: 30000 }).then(() => true, () => false);
  const emailVisible = await page.locator(`text=${ADMIN.email}`).first().isVisible().catch(() => false);
  check('success event row visible', emailVisible, 'email not on page');

  const bodyText = await page.locator('body').innerText().catch(() => '');
  check('success badge visible', bodyText.includes('Réussie'), 'no Réussie badge');
  check('failure badge visible', bodyText.includes('Échouée'), 'no Échouée badge');

  // Screenshot evidence.
  const outDir = path.resolve('future-implementation/settings-platform/.implementation-plan/browser-evidence');
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, 'login-events.png'), fullPage: false });
  console.log(`  [shot] ${outDir}/login-events.png`);

  await browser.close();

  // Cleanup: remove test events.
  const del = await pool.query(
    `DELETE FROM login_events WHERE lower(email) = lower($1)`,
    [ADMIN.email],
  );
  check(`cleanup — removed ${del.rowCount} event(s)`, del.rowCount >= 1, 'nothing to clean');
  await pool.end();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) { console.log('Failures:', failures.join(' | ')); process.exit(1); }
}

run().catch(err => { console.error(err); process.exit(1); });
