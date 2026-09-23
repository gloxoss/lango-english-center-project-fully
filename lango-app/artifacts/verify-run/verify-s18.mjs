// Independent verification for S-18 (read-only): SchoolOS must never claim the
// school is CNDP-compliant unless the filing registry says so.
//
// Checks, per the finding's "Done when" (badge matches /settings/cndp):
//   1. sign-in shows no compliance claim without filing data
//   2. staff see the real registry status in the header
//   3. the settings page and the badge agree
//   4. family accounts get no badge at all
//   5. an unreadable registry reads as unavailable, never compliant
//   6. the same holds in Arabic (RTL)
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3555';
const OUT = 'artifacts/verify-run';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Admin123!';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
const check = (label, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

async function session(email, locale = 'fr-FR') {
  const ctx = await browser.newContext({ locale, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.evaluate(async ([mail, password]) => {
    await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mail, password }),
    });
  }, [email, PASSWORD]);
  return { ctx, page };
}

// 1. Sign-in carries no compliance claim.
{
  const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/s18-01-login-no-compliance-claim.png`, fullPage: true });
  const text = await page.locator('body').innerText();
  // A status claim (the school conforms / is declared) is what must never appear
  // without filing data. A product capability line is a different statement and
  // lives in locale copy I do not own.
  check('sign-in makes no compliance status claim', !/Conforme CNDP|Conforme \/ Récépissé|Conformité CNDP Garantie/i.test(text));
  await ctx.close();
}

// 2 and 3. Staff: header badge reflects the registry and matches /settings/cndp.
const admin = await session('y.elamrani@atlas.ma');
{
  await admin.page.goto(`${BASE}/fr/dashboard/settings/cndp`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await admin.page.waitForTimeout(2500);
  await admin.page.screenshot({ path: `${OUT}/s18-02-settings-cndp.png`, fullPage: true });
  const settingsText = await admin.page.locator('body').innerText();
  const settingsStatus = ['Conforme / Récépissé', 'En cours', 'Non déposé'].find((s) => settingsText.includes(s)) ?? null;
  check('settings page states a real status', Boolean(settingsStatus), settingsStatus ?? 'none found');

  await admin.page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await admin.page.waitForTimeout(3000);
  await admin.page.screenshot({ path: `${OUT}/s18-03-header-badge-school-admin.png`, fullPage: true });
  const headerText = await admin.page.locator('body').innerText();
  const badgeStatus = ['Conforme / Récépissé', 'En cours', 'Non déposé', 'Information non disponible']
    .find((s) => headerText.includes(`CNDP : ${s}`)) ?? null;
  check('header badge shows the registry status', Boolean(badgeStatus), badgeStatus ?? 'no badge');
  check('badge matches /settings/cndp', badgeStatus !== null && badgeStatus === settingsStatus,
    `badge=${badgeStatus} settings=${settingsStatus}`);
  check('no blanket compliance claim in the app chrome', !/Conforme CNDP F211|Conformité CNDP Garantie/i.test(headerText));
}

// 4. Family accounts get no badge.
const parent = await session('parent.001@atlas.ma');
{
  await parent.page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await parent.page.waitForTimeout(2500);
  await parent.page.screenshot({ path: `${OUT}/s18-04-header-badge-hidden-parent.png`, fullPage: true });
  const text = await parent.page.locator('body').innerText();
  check('parent sees no CNDP badge', !/CNDP :/.test(text));
}

// 5. Unreadable registry must read as unavailable, never compliant.
{
  await admin.ctx.route('**/api/settings/cndp-filing**', (route) => route.abort());
  await admin.page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await admin.page.waitForTimeout(2500);
  await admin.page.screenshot({ path: `${OUT}/s18-05-unreadable-registry.png`, fullPage: true });
  const text = await admin.page.locator('body').innerText();
  check('failed fetch reads as unavailable', text.includes('CNDP : Information non disponible'));
  check('failed fetch never reads as compliant', !/CNDP : Conforme/i.test(text));
  await admin.ctx.unroute('**/api/settings/cndp-filing**');
}

// 6. Arabic.
const arabic = await session('y.elamrani@atlas.ma', 'ar-MA');
{
  await arabic.page.goto(`${BASE}/ar/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await arabic.page.waitForTimeout(3000);
  await arabic.page.screenshot({ path: `${OUT}/s18-06-arabic-rtl.png`, fullPage: true });
  const text = await arabic.page.locator('body').innerText();
  check('Arabic UI states the same real status', /CNDP : (Conforme \/ Récépissé|En cours|Non déposé|Information non disponible)/.test(text));
  check('Arabic UI makes no blanket claim', !/Conforme CNDP F211/i.test(text));
}

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await browser.close();
