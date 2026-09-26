// SETTINGS-CORE-FIX-01 section proofs: screenshots FR desktop / FR 390px / AR
// for the pages changed by SCF-02 (calendar after the year switch), SCF-03
// (Organisation year block read-only), SCF-04-01 (Attendance settings),
// SCF-04-02 (/settings/policies redirect), SCF-05 (grading policies).
// Run: BASE=http://localhost:3537 node artifacts/product-discovery/SETTINGS-CORE-FIX-01/shots-sections.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const H = process.env.BASE ?? 'http://localhost:3537';
const OUT = 'artifacts/product-discovery/SETTINGS-CORE-FIX-01/screenshots';

const TARGETS = [
  ['scf02-05-calendar', '/dashboard/academics/calendar'],
  ['scf03-01-organization', '/dashboard/settings/onboarding'],
  ['scf04-01-attendance-settings', '/dashboard/settings/attendance'],
  ['scf05-01-grading-policies', '/dashboard/academics/grading/policies'],
];
const VARIANTS = [
  { id: 'fr', locale: 'fr', viewport: { width: 1440, height: 900 } },
  { id: 'fr-phone', locale: 'fr', viewport: { width: 390, height: 844 } },
  { id: 'ar', locale: 'ar', viewport: { width: 1440, height: 900 } },
];

const browser = await chromium.launch();
for (const v of VARIANTS) {
  for (const [id, route] of TARGETS) {
    const ctx = await browser.newContext({ viewport: v.viewport, locale: v.locale === 'ar' ? 'ar-MA' : 'fr-FR' });
    const login = await ctx.request.post(`${H}/api/auth/sign-in/email`, {
      headers: { Origin: H, 'Content-Type': 'application/json' },
      data: { email: 'y.elamrani@atlas.ma', password: 'Admin123!' },
    });
    if (login.status() !== 200) throw new Error(`login failed: ${login.status()}`);
    const page = await ctx.newPage();
    const consoleErrors = [];
    const api5xx = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 140)); });
    page.on('response', res => { if (res.url().includes('/api/') && res.status() >= 500) api5xx.push(`${res.status()} ${res.url().replace(H, '')}`); });

    const resp = await page.goto(`${H}/${v.locale}${route}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return {
        text: (main.innerText || '').slice(0, 6000),
        dir: document.documentElement.dir,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        missingKeys: [...new Set(((main.innerText || '').match(/\b(?:NumberingSettings|AttendanceSettings|OrganizationSettings|Grading|Settings|Common|Navigation)\.[A-Za-z0-9_]+\b/g) || []))].slice(0, 8),
      };
    });
    const file = `${OUT}/${id}-${v.id}.png`;
    await page.screenshot({ path: file, fullPage: true });
    fs.writeFileSync(`${OUT}/${id}-${v.id}.json`, JSON.stringify({ ...info, status: resp?.status(), url: page.url().replace(H, ''), consoleErrors: consoleErrors.slice(0, 4), api5xx }, null, 2));
    console.log(`${id}-${v.id}: status=${resp?.status()} url=${page.url().replace(H, '')} dir=${info.dir} overflowX=${info.overflowX} missingKeys=${info.missingKeys.join(',') || 'none'} 5xx=${api5xx.join(';') || 'none'}`);
    await ctx.close();
  }
}

// SCF-04-02: /settings/policies must redirect to the grading policies page.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  await ctx.request.post(`${H}/api/auth/sign-in/email`, { headers: { Origin: H, 'Content-Type': 'application/json' }, data: { email: 'y.elamrani@atlas.ma', password: 'Admin123!' } });
  const page = await ctx.newPage();
  const resp = await page.goto(`${H}/fr/dashboard/settings/policies`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(800);
  console.log(`scf04-02-policies-redirect: status=${resp?.status()} final=${page.url().replace(H, '')}`);
  await page.screenshot({ path: `${OUT}/scf04-02-policies-redirect-fr.png`, fullPage: true });
  fs.writeFileSync(`${OUT}/scf04-02-policies-redirect-fr.json`, JSON.stringify({ status: resp?.status(), final: page.url().replace(H, '') }, null, 2));
  await ctx.close();
}
await browser.close();
