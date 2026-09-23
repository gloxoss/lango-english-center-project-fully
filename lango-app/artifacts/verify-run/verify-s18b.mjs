// S-18 remediation: the CNDP badge must not fire a request that has to be
// refused. It asks only for roles that may read the filing, so no other role
// ever sees a 403 from it.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3555';
const OUT = 'artifacts/verify-run';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Admin123!';
const TARGET = '**/api/settings/cndp-filing**';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (label, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch({ headless: true });

async function probe(email, shot) {
  const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const calls = [];
  page.on('response', (r) => { if (new URL(r.url()).pathname.includes('/api/settings/cndp-filing')) calls.push(r.status()); });

  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.evaluate(async ([mail, password]) => {
    await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mail, password }),
    });
  }, [email, PASSWORD]);

  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(3500);
  if (shot) await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
  const text = await page.locator('body').innerText();
  const badge = /CNDP : (Conforme \/ Récépissé|En cours|Non déposé|Information non disponible)/.exec(text)?.[0] ?? null;
  await ctx.close();
  return { calls, badge };
}

for (const [label, email, shot] of [
  ['school_admin', 'y.elamrani@atlas.ma', 's18b-school-admin'],
  ['accountant', 'accountant@atlas.ma', 's18b-accountant'],
  ['teacher', 'prof.01@atlas.ma', 's18b-teacher'],
  ['parent', 'parent.001@atlas.ma', 's18b-parent'],
  ['student', 'etudiant.0001@atlas.ma', 's18b-student'],
]) {
  const { calls, badge } = await probe(email, shot);
  const refused = calls.filter((s) => s === 401 || s === 403);
  check(`${label}: no refused CNDP request`, refused.length === 0, `calls=${JSON.stringify(calls)}`);
  if (label === 'school_admin') check('school_admin: truthful registry status', Boolean(badge), badge ?? 'no badge');
  else check(`${label}: badge hidden (no request made)`, calls.length === 0, badge ?? 'no badge');
}

// Registry unreachable must never read as compliant.
{
  const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.evaluate(async () => {
    await fetch('/api/auth/sign-in/email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'y.elamrani@atlas.ma', password: 'Admin123!' }),
    });
  });
  await ctx.route(TARGET, (route) => route.abort());
  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(3000);
  const text = await page.locator('body').innerText();
  check('registry down: reads as unavailable', text.includes('CNDP : Information non disponible'));
  check('registry down: never reads as compliant', !/CNDP : Conforme/i.test(text));
  await ctx.close();
}

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await browser.close();
