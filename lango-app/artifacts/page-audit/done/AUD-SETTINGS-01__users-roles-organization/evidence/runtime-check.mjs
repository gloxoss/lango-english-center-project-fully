import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.AUDIT_BASE ?? 'http://localhost:3591';
const evidenceDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const shots = path.resolve(evidenceDir, '../screenshots');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
const page = await context.newPage();
const results = [];
let createdUserId = null;
let originalShortName = null;
let changedShortName = false;
let originalGrant = null;

const api = async (route, method = 'GET', body) => page.evaluate(async ({ route, method, body }) => {
  const response = await fetch(route, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}, { route, method, body });

try {
  await page.goto(`${base}/fr/login`);
  const signIn = await api('/api/auth/sign-in/email', 'POST', {
    email: process.env.ACCOUNT_EMAIL ?? 'y.elamrani@atlas.ma',
    password: process.env.AUDIT_PASSWORD ?? 'Admin123!',
  });
  if (signIn.status !== 200) throw new Error(`Sign-in HTTP ${signIn.status}`);
  await page.goto(`${base}/fr/dashboard/settings/users`);
  if (!page.url().endsWith('/dashboard/settings/users')) throw new Error('Users page bounced');

  const email = `aud-settings-${Date.now()}@example.test`;
  const created = await api('/api/users', 'POST', { fullName: 'Audit Settings', email, role: 'teacher' });
  if (created.status !== 200 || !created.body?.data?.id) throw new Error(`Create user HTTP ${created.status}`);
  createdUserId = created.body.data.id;
  await page.reload();
  await page.getByPlaceholder('Rechercher par nom, email…').fill(email);
  const row = page.locator('tr').filter({ hasText: email });
  await row.getByRole('button', { name: /Modifier/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifier un utilisateur' });
  await dialog.waitFor();
  await page.screenshot({ path: path.join(shots, 'school_admin-fr-users-edit-modal.png') });
  await dialog.locator('select').nth(0).selectOption('accountant');
  await dialog.locator('select').nth(1).selectOption('inactive');
  const branchSelect = dialog.locator('select').nth(2);
  const branchValues = await branchSelect.locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
  if (branchValues.length) await branchSelect.selectOption(branchValues[0]);
  page.once('dialog', dialog => dialog.accept());
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.reload();
  await page.getByPlaceholder('Rechercher par nom, email…').fill(email);
  const userRow = page.locator('tr').filter({ hasText: email });
  if (!(await userRow.innerText()).includes('Comptable') || !(await userRow.innerText()).includes('Inactif')) {
    throw new Error('Edited role/status did not persist after reload');
  }
  results.push({ workflow: 'user create/edit/role/status/branch/reload', result: 'PASS', branchAssigned: branchValues.length > 0 });

  await page.goto(`${base}/fr/dashboard/settings/permissions`);
  const matrix = await api('/api/settings/permissions');
  originalGrant = matrix.body?.data?.matrix?.guard?.['finance.approve'];
  if (matrix.status !== 200 || typeof originalGrant !== 'boolean') throw new Error('Permission matrix unavailable');
  const targetLabel = `${originalGrant ? 'Révoquer' : 'Accorder'}: finance.approve, Gardien`;
  if (originalGrant) page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: targetLabel }).click();
  const toggled = await api('/api/settings/permissions');
  if (toggled.body?.data?.matrix?.guard?.['finance.approve'] === originalGrant) throw new Error('Matrix toggle did not persist');
  await page.reload();
  results.push({ workflow: 'permission matrix toggle/reload', result: 'PASS' });

  await page.goto(`${base}/fr/dashboard/settings/onboarding`);
  const shortName = page.locator('input[placeholder="ex: LEC"]');
  originalShortName = await shortName.inputValue();
  await shortName.fill('AUDSETTINGS');
  const settingsResponse = page.waitForResponse(response => response.url().endsWith('/api/settings') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const saveResponse = await settingsResponse;
  if (saveResponse.status() !== 200) {
    const payload = await saveResponse.json().catch(() => null);
    throw new Error(`Organization save HTTP ${saveResponse.status()}: ${JSON.stringify(payload?.error)}`);
  }
  await page.getByText('Paramètres enregistrés avec succès.').waitFor();
  changedShortName = true;
  await page.screenshot({ path: path.join(shots, 'school_admin-fr-organization-saved.png') });
  await page.reload();
  if (await page.locator('input[placeholder="ex: LEC"]').inputValue() !== 'AUDSETTINGS') throw new Error('Organization save did not persist');
  results.push({ workflow: 'organization save/reload', result: 'PASS' });
} finally {
  if (changedShortName) {
    await page.goto(`${base}/fr/dashboard/settings/onboarding`).catch(() => {});
    await page.locator('input[placeholder="ex: LEC"]').fill(originalShortName ?? '').catch(() => {});
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click().catch(() => {});
  }
  if (originalGrant !== null) {
    await api('/api/settings/permissions', 'POST', { roleId: 'guard', permissionId: 'finance.approve', granted: originalGrant }).catch(() => {});
  }
  if (createdUserId) {
    await api(`/api/users?id=${encodeURIComponent(createdUserId)}`, 'DELETE').catch(() => {});
  }
  fs.writeFileSync(path.join(evidenceDir, 'runtime-results.json'), `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();
}

console.log(results);
