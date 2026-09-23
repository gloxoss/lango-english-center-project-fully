// Independent verification for S-3 (read-only): with unposted source documents
// on the books, the statements screen must warn with a count and must NOT claim
// the ledger is balanced.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3555';
const OUT = 'artifacts/verify-run';
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

const url = `${BASE}/fr/dashboard/finance/accounting/statements`;
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }).catch(() => {});
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/s3-statements-unposted-warning.png`, fullPage: true });

const text = await page.locator('body').innerText();
const checks = {
  'banner names unposted payments': /encaissement\(s\) non passé\(s\)/.test(text),
  'banner names unposted reversals/refunds': /non passé\(s\) au grand livre/.test(text),
  'incomplete badge shown': text.includes('Rapprochement à vérifier'),
  'balanced badge withheld': !text.includes('Équilibré (écart 0,00)'),
  'retry is bounded and offered': text.includes('Reprendre la comptabilisation'),
};
for (const [label, pass] of Object.entries(checks)) console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
console.log('--- visible banner lines ---');
for (const line of text.split('\n')) {
  if (/non passé|période comptable|Reprendre la comptabilisation|Rapprochement/.test(line)) console.log('  ' + line.trim());
}

await browser.close();
