// Read-only visual capture for the auditor. Never clicks anything (no SMS,
// no payments). Logs in, warms each route once (dev-server compile lag),
// then captures desktop / phone / Arabic and records failed (4xx/5xx) calls and
// console errors per page.
// Usage: node scripts/visual-capture.mjs <role> <label:/route> [...]
// Env: AUDIT_BASE (default http://localhost:3111), VARIANTS=desktop,phone,ar,
//      ACCOUNT_EMAIL (override the seed account), SHOTS_DIR (default artifacts/visual-audit).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3111';
const OUT = process.env.SHOTS_DIR ?? path.resolve('artifacts/visual-audit');
const ACCOUNTS = {
  school_admin: 'y.elamrani@atlas.ma', teacher: 'prof.01@atlas.ma', accountant: 'accountant@atlas.ma',
  parent: 'parent.001@atlas.ma', student: 'etudiant.0001@atlas.ma', guard: 'securite@atlas.ma',
  receptionist: 'accueil@atlas.ma', super_admin: 'superadmin@schoolos.ma',
};
const [role, ...targets] = process.argv.slice(2);
const variants = (process.env.VARIANTS ?? 'desktop,phone,ar').split(',');
fs.mkdirSync(OUT, { recursive: true });

async function login(browser, viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('input[type="email"]').fill(process.env.ACCOUNT_EMAIL ?? ACCOUNTS[role]);
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 60000 }).catch(() => {});
  return { ctx, page };
}

const report = [];
const browser = await chromium.launch({ headless: true });
const desktop = await login(browser, { width: 1440, height: 900 });
let phone = null;
if (variants.includes('phone')) {
  // Reuse the desktop session cookies: a second rapid sign-in trips the limiter.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await desktop.ctx.storageState() });
  phone = { ctx, page: await ctx.newPage() };
}
const sessions = { desktop, phone };

for (const t of targets) {
  const [label, route] = t.split(':');
  for (const v of variants) {
    const s = v === 'phone' ? sessions.phone : sessions.desktop;
    if (!s) continue;
    const locale = v === 'ar' ? 'ar' : 'fr';
    const url = `${BASE}/${locale}${route}`;
    const errors = [];
    const onResp = r => { if (r.status() >= 400 && r.status() !== 404 || (r.status() === 404 && r.url().includes('/api/'))) errors.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 120)}`); };
    const onConsole = m => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`); };
    // Warm once (compile), then measure on a clean load.
    await s.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
    await s.page.waitForTimeout(1500);
    s.page.on('response', onResp); s.page.on('console', onConsole);
    await s.page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
    await s.page.waitForTimeout(2500);
    const file = path.join(OUT, `${role}-${label}-${v}.png`);
    await s.page.screenshot({ path: file, fullPage: v === 'phone' ? false : true });
    const hScroll = await s.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    const dir = await s.page.evaluate(() => document.documentElement.dir || getComputedStyle(document.body).direction);
    s.page.off('response', onResp); s.page.off('console', onConsole);
    report.push({ role, label, variant: v, finalUrl: s.page.url().replace(BASE, ''), hScroll, dir, errors: [...new Set(errors)].slice(0, 8), file: path.basename(file) });
    console.log(JSON.stringify(report.at(-1)));
  }
}
fs.writeFileSync(path.join(OUT, `report-${role}.json`), JSON.stringify(report, null, 2));
await browser.close();
