import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3111';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Admin123!';
const OUT_DIR = path.resolve('artifacts/page-audit/done/AUD-FINANCE-01__student-billing-cashier/screenshots');

console.log(`Starting Arabic RTL Visual Cleanup against ${BASE}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'ar-MA',
});
const page = await ctx.newPage();

// 1. Authenticate as school_admin (same tenant/branch context as French evidence)
console.log('Authenticating as y.elamrani@atlas.ma...');
await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
const loginRes = await page.evaluate(async ([mail, pass, base]) => {
  const res = await fetch('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ email: mail, password: pass }),
  });
  return { ok: res.ok, status: res.status };
}, ['y.elamrani@atlas.ma', PASSWORD, BASE]);

if (!loginRes.ok) {
  throw new Error(`Login failed: ${loginRes.status}`);
}

// Warm up session and navigate to dashboard
await page.goto(`${BASE}/ar/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);

// Verify authenticated role and user in DOM
await page.waitForFunction(() => {
  const t = document.body.innerText;
  return t.includes('Yassine El Amrani') || t.includes('y.elamrani@atlas.ma');
}, { timeout: 30000 });
console.log('Authenticated session confirmed.');

const hideDevOverlays = async () => {
  await page.addStyleTag({
    content: 'nextjs-portal, #__next-build-watcher, [data-nextjs-toast], nextjs-portal * { display: none !important; opacity: 0 !important; pointer-events: none !important; }'
  }).catch(() => {});
};

// ==========================================
// 17. Invoices Arabic RTL Desktop
// ==========================================
console.log('\n--- Capturing 17-invoices-desktop-ar-rtl.png ---');
await page.goto(`${BASE}/ar/dashboard/finance/invoices`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

// Wait for real invoices data to load (exact same 4 invoices as French)
console.log('Waiting for invoices data to load in table...');
await page.waitForFunction(() => {
  const rows = document.querySelectorAll('table tbody tr');
  return rows.length >= 4;
}, { timeout: 30000 });

// Wait for branch switcher to be loaded ("جميع الفروع")
console.log('Waiting for branch switcher...');
await page.waitForFunction(() => {
  return document.body.innerText.includes('جميع الفروع');
}, { timeout: 20000 });

// Wait for active role in sidebar ("المدير / الإدارة")
console.log('Waiting for active role...');
await page.waitForFunction(() => {
  return document.body.innerText.includes('المدير / الإدارة');
}, { timeout: 20000 });

// Ensure no loading text or pulse
await page.waitForFunction(() => {
  const text = document.body.innerText;
  return !text.includes('Chargement…') && !text.includes('Chargement...') && !text.includes('جاري التحميل');
}, { timeout: 15000 }).catch(() => {});
await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10000 }).catch(() => {});

await hideDevOverlays();
await page.waitForTimeout(2000);

const shot17Path = path.join(OUT_DIR, '17-invoices-desktop-ar-rtl.png');
await page.screenshot({ path: shot17Path, fullPage: true });
console.log(`Saved: ${shot17Path} (${fs.statSync(shot17Path).size} bytes)`);

// Check table content in page
const invoiceTableRows = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  return rows.map(r => r.innerText.replace(/\s+/g, ' ').trim());
});
console.log(`Verified Arabic invoices rendered: ${invoiceTableRows.length} rows`);
invoiceTableRows.forEach((r, idx) => console.log(`  Row ${idx + 1}: ${r.slice(0, 80)}...`));

// ==========================================
// 18. Collection Desk Arabic RTL Desktop
// ==========================================
console.log('\n--- Capturing 18-collection-desk-desktop-ar-rtl.png ---');
await page.goto(`${BASE}/ar/dashboard/finance/collection-desk`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

// Wait for collection desk heading
await page.waitForSelector('h1', { timeout: 20000 });

// Wait for branch switcher to be loaded ("جميع الفروع")
console.log('Waiting for branch switcher...');
await page.waitForFunction(() => {
  return document.body.innerText.includes('جميع الفروع');
}, { timeout: 20000 });

// Wait for active role in sidebar ("المدير / الإدارة")
console.log('Waiting for active role...');
await page.waitForFunction(() => {
  return document.body.innerText.includes('المدير / الإدارة');
}, { timeout: 20000 });

// Ensure no loading text or pulse
await page.waitForFunction(() => {
  const text = document.body.innerText;
  return !text.includes('Chargement…') && !text.includes('Chargement...') && !text.includes('جاري التحميل');
}, { timeout: 15000 }).catch(() => {});
await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 10000 }).catch(() => {});

await hideDevOverlays();
await page.waitForTimeout(2000);

const shot18Path = path.join(OUT_DIR, '18-collection-desk-desktop-ar-rtl.png');
await page.screenshot({ path: shot18Path, fullPage: true });
console.log(`Saved: ${shot18Path} (${fs.statSync(shot18Path).size} bytes)`);

const deskHeading = await page.locator('h1').last().innerText();
console.log(`Verified Collection Desk Heading: "${deskHeading}"`);

await browser.close();
console.log('\nRecapture complete! Both screenshots updated.');
