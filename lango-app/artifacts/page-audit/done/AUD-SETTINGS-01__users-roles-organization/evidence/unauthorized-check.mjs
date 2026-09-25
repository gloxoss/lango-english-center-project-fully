import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.AUDIT_BASE ?? 'http://localhost:3591';
const evidenceDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const accounts = {
  teacher: 'fz.idrissi@atlas.ma',
  accountant: 'accountant@atlas.ma',
  receptionist: 'accueil@atlas.ma',
};
const browser = await chromium.launch({ headless: true });
const rows = [];
try {
  for (const [role, email] of Object.entries(accounts)) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${base}/fr/login`);
    const signIn = await page.evaluate(async ({ email, password }) => {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      return response.status;
    }, { email, password: process.env.AUDIT_PASSWORD ?? 'Admin123!' });
    if (signIn !== 200) throw new Error(`${role}: sign-in ${signIn}`);
    const statuses = await page.evaluate(async () => {
      const users = await fetch('/api/users');
      const permissions = await fetch('/api/settings/permissions');
      const settings = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const logo = await fetch('/api/settings/logo', { method: 'POST', body: new FormData() });
      return { users: users.status, permissions: permissions.status, settings: settings.status, logo: logo.status };
    });
    if (Object.values(statuses).some(status => status !== 403)) throw new Error(`${role}: unexpected status ${JSON.stringify(statuses)}`);
    await page.goto(`${base}/fr/dashboard/settings/users`);
    const finalPath = new URL(page.url()).pathname;
    if (finalPath.endsWith('/dashboard/settings/users')) throw new Error(`${role}: users page accessible`);
    if (role === 'teacher') await page.screenshot({ path: path.resolve(evidenceDir, '../screenshots/teacher-fr-users-denied.png') });
    rows.push({ role, statuses, usersPage: finalPath, result: 'PASS' });
    await context.close();
  }
  fs.writeFileSync(path.join(evidenceDir, 'unauthorized-results.json'), `${JSON.stringify(rows, null, 2)}\n`);
  console.log(rows);
} finally {
  await browser.close();
}
