// SETTINGS-CORE-FIX-01 evidence probe for SCF-02-03 (open-year dialog) and
// SCF-02-05 (Atlas on dev switched through the app's own action).
//
// Everything here goes through the running app: the same session cookie the
// browser would have, the same /api/academics/session-years/open route the
// dialog calls, the same UI the director sees. Nothing writes to Postgres
// directly, so the audit trail the app writes is the evidence.
//
// Usage: AUDIT_BASE=http://localhost:3512 node artifacts/product-discovery/SETTINGS-CORE-FIX-01/probe-open-year.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3512';
const EMAIL = process.env.ACCOUNT_EMAIL ?? 'y.elamrani@atlas.ma';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Admin123!';
const OUT = path.resolve('artifacts/product-discovery/SETTINGS-CORE-FIX-01/screenshots');
const TARGET_NAME = process.env.TARGET_YEAR ?? '2026-2027';
const PREVIOUS_NAME = process.env.PREVIOUS_YEAR ?? '2025-2026';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function session(locale, viewport) {
  const ctx = await browser.newContext({
    locale: locale === 'ar' ? 'ar-MA' : 'fr-FR',
    viewport,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const res = await page.evaluate(async ([e, p]) => {
    const r = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e, password: p }),
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  }, [EMAIL, PASSWORD]);
  if (res.status !== 200 && res.status !== 201) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.json)}`);
  return { ctx, page };
}

/** Calls the app's own route with the page's session cookie. */
async function api(page, url, init) {
  return page.evaluate(async ([u, i]) => {
    const r = await fetch(u, i ?? undefined);
    return { status: r.status, json: await r.json().catch(() => null) };
  }, [url, init ?? null]);
}

const years = async page => (await api(page, '/api/academics/session-years')).json?.data ?? [];

const { ctx, page } = await session('fr', { width: 1440, height: 900 });
const report = {};

// ── 0. Resolve the two years by name, whatever their ids are ─────────────────
let list = await years(page);
const target = list.find(y => y.name === TARGET_NAME);
const previous = list.find(y => y.name === PREVIOUS_NAME);
if (!target || !previous) throw new Error(`years not found: have ${list.map(y => y.name).join(', ')}`);
report.yearsBefore = list.map(y => ({ name: y.name, isDefault: y.isDefault, startDate: y.startDate, endDate: y.endDate }));

// ── 1. Put dev Atlas back on the older year THROUGH THE APP, so the "before"
//      state is real and the transition below has a genuine before/after ──────
if (target.isDefault) {
  const back = await api(page, '/api/academics/session-years/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionYearId: previous.id }),
  });
  report.revertedToPrevious = { status: back.status, ...(back.json ?? {}) };
  list = await years(page);
  report.yearsAfterRevert = list.map(y => ({ name: y.name, isDefault: y.isDefault }));
}

// ── 2. BEFORE: the dashboard banner (SCF-02-04's own before-state) ───────────
for (const [locale, viewport, suffix] of [
  ['fr', { width: 1440, height: 900 }, 'fr'],
  ['fr', { width: 390, height: 844 }, 'fr-phone'],
  ['ar', { width: 1440, height: 900 }, 'ar'],
]) {
  const s = locale === 'fr' && suffix === 'fr' ? { ctx, page } : await session(locale, viewport);
  await s.page.goto(`${BASE}/${locale}/dashboard`, { waitUntil: 'networkidle', timeout: 120000 });
  await s.page.waitForTimeout(1500);
  const bannerText = await s.page.evaluate(() => {
    const el = document.querySelector('[role="status"]');
    return el ? el.innerText.replace(/\s+/g, ' ').trim() : null;
  });
  if (suffix === 'fr') report.bannerBefore = bannerText;
  const f = `${OUT}/scf02-before-${suffix}-dashboard.png`;
  await s.page.screenshot({ path: f, fullPage: false });
  report[`shot_before_${suffix}`] = path.relative(process.cwd(), f);
  if (s.page !== page) await s.ctx.close();
}

// ── 3. The checklist the dialog shows, read from the app's own preview route ─
const preview = await api(page, `/api/academics/session-years/open?sessionYearId=${encodeURIComponent(target.id)}`);
report.checklist = preview.json?.data ?? { error: preview.json, status: preview.status };

// ── 4. The dialog on screen (SCF-02-03's deliverable) ───────────────────────
for (const [locale, viewport, suffix] of [
  ['fr', { width: 1440, height: 900 }, 'fr'],
  ['fr', { width: 390, height: 844 }, 'fr-phone'],
  ['ar', { width: 1440, height: 900 }, 'ar'],
]) {
  const s = await session(locale, viewport);
  await s.page.goto(`${BASE}/${locale}/dashboard/academics/calendar`, { waitUntil: 'networkidle', timeout: 120000 });
  await s.page.waitForTimeout(1200);
  // The row button carries the action's own title (locale-dependent), so find it
  // by the accessible name we set, not by a hardcoded French string.
  const rowName = locale === 'ar' ? 'افتح هذه السنة' : locale === 'en' ? 'Open this year' : 'Ouvrir cette année';
  const clicked = await s.page.evaluate((name) => {
    const btn = [...document.querySelectorAll('button[title]')].find(b => b.getAttribute('title') === name);
    if (!btn) return false;
    btn.click();
    return true;
  }, rowName);
  await s.page.waitForTimeout(2500);
  const dialogText = await s.page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find(el => el.innerText.includes('année') || el.innerText.includes('سنة') || el.innerText.includes('year'));
    return h ? h.closest('div.fixed')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 900) ?? null : null;
  });
  report[`dialog_${suffix}`] = { clicked, text: dialogText };
  const f = `${OUT}/scf02-03-open-year-dialog-${suffix}.png`;
  await s.page.screenshot({ path: f, fullPage: false });
  report[`shot_dialog_${suffix}`] = path.relative(process.cwd(), f);
  await s.ctx.close();
}

// ── 5. Open the year through the app, then prove the after-state ─────────────
const opened = await api(page, '/api/academics/session-years/open', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionYearId: target.id }),
});
report.openResult = { status: opened.status, ...(opened.json ?? {}) };

list = await years(page);
report.yearsAfter = list.map(y => ({ name: y.name, isDefault: y.isDefault }));
const after = await api(page, `/api/academics/session-years/open?sessionYearId=${encodeURIComponent(target.id)}`);
report.checklistAfter = after.json?.data?.checks ?? null;

// The dashboard the students list and the summary now resolve to.
const dashCtx = await session('fr', { width: 1440, height: 900 });
await dashCtx.page.goto(`${BASE}/fr/dashboard`, { waitUntil: 'networkidle', timeout: 120000 });
await dashCtx.page.waitForTimeout(1500);
const bannerAfter = await dashCtx.page.evaluate(() => {
  const el = document.querySelector('[role="status"]');
  return el ? el.innerText.replace(/\s+/g, ' ').trim() : null;
});
report.bannerAfter = bannerAfter;
const f = `${OUT}/scf02-05-after-fr-dashboard.png`;
await dashCtx.page.screenshot({ path: f, fullPage: false });
report.shot_after_fr = path.relative(process.cwd(), f);

fs.writeFileSync(
  path.resolve('artifacts/product-discovery/SETTINGS-CORE-FIX-01/scf-02-03-02-05-evidence.json'),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
await browser.close();
