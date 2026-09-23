// Evidence for S-2: the reminders page must list late families, and a failed
// fetch must show an error rather than an all-clear. Read-only.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3555';
const OUT = 'artifacts/s-2-reminders';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Admin123!';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.evaluate(async ([email, password]) => {
  await fetch('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}, ['y.elamrani@atlas.ma', PASSWORD]);

// Warm the route first: on a cold compile the first paint can carry the
// previous bundle or aborted fetches, which would put a stale screen in here.
const url = `${BASE}/fr/dashboard/communication/reminders`;
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }).catch(() => {});
await page.waitForTimeout(3000);

for (const [label, delay] of [['t+4s', 4000], ['t+7s', 3000], ['t+11s', 4000]]) {
  await page.waitForTimeout(delay);
  await page.screenshot({ path: `${OUT}/01-reminders-${label}.png`, fullPage: true });
  const text = await page.locator('body').innerText();
  const rows = await page.locator('tbody tr').count();
  const riskMarkers = (text.match(/Impayés|Absences répétées|Absences et impayés/g) || []).length;
  console.log(`${label}: rows=${rows} riskLabels=${riskMarkers} allClear=${text.includes('au vert')} error=${/Impossible|erreur/i.test(text)}`);
}
const text = await page.locator('body').innerText();

// Second state: the audience call fails. The page must say so and offer a retry,
// never "0 at risk, all green".
await ctx.route('**/api/communication/reminder-audience**', (route) => route.abort());
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/02-reminders-failed-fetch-error.png`, fullPage: true });
const failedText = await page.locator('body').innerText();
console.log(`failed fetch -> all-clear shown: ${failedText.includes('au vert')}`);
console.log(`failed fetch -> error text present: ${/Impossible|destinataires/i.test(failedText)}`);

await browser.close();
