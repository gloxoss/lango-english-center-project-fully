// Evidence capture for the Communication closeout.
//
// Read-only against the app: it fills the composer form and clicks a report row
// (a GET), and never creates, approves, schedules or sends a campaign. Every
// number in these screenshots comes from the broadcast API responses.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3555';
const OUT = process.env.OUT_DIR ?? 'artifacts/communication-closeout';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Admin123!';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function signedInPage(email, { locale = 'fr-FR', viewport = { width: 1440, height: 900 } } = {}) {
  const ctx = await browser.newContext({ locale, viewport });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.evaluate(async ([mail, pass]) => {
    await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mail, password: pass }),
    });
  }, [email, PASSWORD]);
  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180000 }).catch(() => {});
  return page;
}

async function shot(page, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  // Log what the page actually rendered, so a screenshot can never be filed
  // under a state it does not show.
  const heading = await page.locator('main h1').first().innerText().catch(() => '(no main h1)');
  const text = await page.locator('body').innerText();
  // Fixture strings from the two removed data modules. The admin's own name
  // ("Yassine El Amrani") is real session data and is deliberately not banned.
  const banned = [
    '420 contacts', '420 destinataires', '18 450', '99,2', '74,8', '52,1', 'Canal N°1',
    '28 mai 2025', 'Rappel Réunion de Rentrée', 'Offre Portes Ouvertes Maarif',
    'Alerte Impayés', 'Bulletin Trimestre', 'Inclus dans le forfait', 'Chers parents de',
  ];
  const present = banned.filter((b) => text.includes(b));
  console.log(`captured ${name} -> "${heading.replace(/\s+/g, ' ')}"${present.length ? ` BANNED: ${present.join(', ')}` : ' (no invented values)'}`);
}

const admin = await signedInPage('y.elamrani@atlas.ma');

// Warm the dev server first: on a cold compile the first paint can still carry
// the previous bundle, which would put a stale screen into an evidence file.
for (const route of ['/fr/dashboard/communication/campaign-composer', '/fr/dashboard/communication/delivery-reports']) {
  await admin.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await admin.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }).catch(() => {});
  await admin.waitForTimeout(1500);
}

// B: truthful empty state. No audience selected and no preview run, so the
// recipient count reads 0 and the preview panel asks for a preview rather than
// showing sample totals.
await admin.goto(`${BASE}/fr/dashboard/communication/campaign-composer`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await admin.waitForTimeout(1200);
await shot(admin, '02-composer-empty-state');

// A: populated from real API data. The selects hold the tenant's real
// connections, segments and templates, and the count is the segment's stored
// member count.
const formSelects = admin.locator('main select');
const selectCount = await formSelects.count();
for (let i = 0; i < selectCount; i++) {
  const options = await formSelects.nth(i).locator('option').allTextContents();
  if (options.length > 1) await formSelects.nth(i).selectOption({ index: 1 });
}
await admin.locator('main input').first().fill('Rappel réunion parents');
await admin.locator('main textarea').first().fill('Bonjour, la réunion des parents aura lieu la semaine prochaine.');
await admin.waitForTimeout(400);
await shot(admin, '01-composer-populated');

// C: delivery reports over the real campaign records of this tenant.
await admin.goto(`${BASE}/fr/dashboard/communication/delivery-reports`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await admin.waitForTimeout(1200);
await shot(admin, '03-delivery-reports-real-campaigns');

// D: per-campaign detail with the real counts, open and click shown as not
// tracked, and the delivery log either listing real states or saying plainly
// that no delivery events exist.
const firstRow = admin.locator('tbody tr').first();
if (await firstRow.count()) {
  await firstRow.click();
  await admin.waitForTimeout(1200);
  await shot(admin, '04-delivery-reports-metrics-unavailable');
}

// E: API-error state. The broadcast endpoints are aborted at the network layer,
// which is what a backend failure looks like to the client: it has to show an
// error with a retry and must never fall back to sample records.
const failing = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 900 } });
await failing.route('**/api/addons/broadcast/**', (route) => route.abort());
const failingPage = await failing.newPage();
await failingPage.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await failingPage.evaluate(async ([mail, pass]) => {
  await fetch('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: mail, password: pass }),
  });
}, ['y.elamrani@atlas.ma', PASSWORD]);
await failingPage.goto(`${BASE}/fr/dashboard/communication/campaign-composer`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await failingPage.waitForTimeout(1500);
await shot(failingPage, '05-api-error-state');

// Extra evidence for the authorization check: a teacher has no communication.send
// capability, so the page guard rejects the visit outright.
const teacher = await signedInPage('prof.01@atlas.ma');
await teacher.goto(`${BASE}/fr/dashboard/communication/campaign-composer`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await teacher.waitForTimeout(1500);
await shot(teacher, '08-unauthorized-role-rejected');

await browser.close();
console.log('done');
