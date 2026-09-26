// SCF-06-01 screen proof: the Numbering page now lists the real `naming_series`
// counters (label + next number) with a raise-only control.
// Run: BASE=http://localhost:3537 node artifacts/product-discovery/SETTINGS-CORE-FIX-01/shots-scf06.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const H = process.env.BASE ?? 'http://localhost:3537';
const OUT = 'artifacts/product-discovery/SETTINGS-CORE-FIX-01/screenshots';
const variants = [
  { id: 'scf06-01-numbering-fr', locale: 'fr', viewport: { width: 1440, height: 900 } },
  { id: 'scf06-01-numbering-fr-phone', locale: 'fr', viewport: { width: 390, height: 844 } },
  { id: 'scf06-01-numbering-ar', locale: 'ar', viewport: { width: 1440, height: 900 } },
];

const browser = await chromium.launch();
for (const v of variants) {
  const ctx = await browser.newContext({ viewport: v.viewport, locale: v.locale === 'ar' ? 'ar-MA' : 'fr-FR' });
  const r = await ctx.request.post(`${H}/api/auth/sign-in/email`, {
    headers: { Origin: H, 'Content-Type': 'application/json' },
    data: { email: 'y.elamrani@atlas.ma', password: 'Admin123!' },
  });
  if (r.status() !== 200) throw new Error(`login failed: ${r.status()} ${await r.text()}`);
  const page = await ctx.newPage();
  const consoleErrors = [];
  const api5xx = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  page.on('response', res => { if (res.url().includes('/api/') && res.status() >= 500) api5xx.push(`${res.status()} ${res.url().replace(H, '')}`); });

  const resp = await page.goto(`${H}/${v.locale}/dashboard/settings/numbering`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    return {
      text: (main.innerText || '').slice(0, 4000),
      h1: (document.querySelector('main h1, h1')?.textContent || '').trim(),
      dir: document.documentElement.dir,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      missingKeys: [...new Set(((main.innerText || '').match(/\b(?:NumberingSettings|Settings|Common|Navigation)\.[A-Za-z0-9_]+\b/g) || []))],
    };
  });
  const file = `${OUT}/${v.id}.png`;
  await page.screenshot({ path: file, fullPage: true });
  fs.writeFileSync(`${OUT}/${v.id}.json`, JSON.stringify({ ...info, status: resp?.status(), url: page.url(), consoleErrors, api5xx }, null, 2));
  console.log(`--- ${v.id} status=${resp?.status()} dir=${info.dir} overflowX=${info.overflowX} missingKeys=${info.missingKeys.join(',') || 'none'} 5xx=${api5xx.join(';') || 'none'}`);
  console.log(info.text.split('\n').filter(l => /Factures|Reçus|Matricules|Candidats|Employés|Avoirs|Relever|Prochain numéro|Valeur actuelle|Autres|الوصولات|رفع|القيمة/.test(l)).slice(0, 14).join(' | '));
  await ctx.close();
}
await browser.close();
