import { chromium } from 'playwright';
import path from 'node:path';

const base = 'http://localhost:3591';
const shots = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../screenshots');
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, locale, width, height] of [
    ['school_admin-fr-settings__permissions', 'fr', 1440, 900],
    ['school_admin-fr-phone-settings__permissions', 'fr', 390, 844],
    ['school_admin-ar-settings__permissions', 'ar', 1440, 900],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(`${base}/fr/login`);
    const login = await page.evaluate(async ({ email, password }) => {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return response.status;
    }, { email: process.env.ACCOUNT_EMAIL ?? 'y.elamrani@atlas.ma', password: process.env.AUDIT_PASSWORD ?? 'Admin123!' });
    if (login !== 200) throw new Error(`Sign-in HTTP ${login}`);
    await page.goto(`${base}/${locale}/dashboard/settings/permissions`);
    await page.getByRole('heading', { name: locale === 'fr' ? 'Matrice des permissions' : 'مصفوفة الصلاحيات' }).waitFor();
    await page.getByRole('searchbox').fill('users.manage');
    const rows = page.locator('tbody tr').filter({ hasText: 'users.manage' });
    if (await rows.count() !== 1) throw new Error(`Expected one filtered permission, found ${await rows.count()}`);
    if (locale === 'ar' && await page.locator('html').getAttribute('dir') !== 'rtl') throw new Error('Arabic RTL missing');
    await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
    console.log(`${name}: PASS`);
    await context.close();
  }
} finally {
  await browser.close();
}
