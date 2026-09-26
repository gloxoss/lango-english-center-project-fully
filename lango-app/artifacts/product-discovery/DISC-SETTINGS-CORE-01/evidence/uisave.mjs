// Real UI save attempts (no value changes) + interaction states for key pages.
import { chromium } from '@playwright/test';

const H = 'http://localhost:3111';
const OUT = process.env.OUT;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
await ctx.request.post(`${H}/api/auth/sign-in/email`, { headers: { Origin: H, 'Content-Type': 'application/json' }, data: { email: 'y.elamrani@atlas.ma', password: 'Admin123!' } });
const page = await ctx.newPage();

async function saveUnchanged(name, path, buttonRe, apiRe) {
  await page.goto(H + path, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1200);
  const respP = page.waitForResponse(r => apiRe.test(r.url()) && r.request().method() !== 'GET', { timeout: 15000 }).catch(() => null);
  const btn = page.getByRole('button', { name: buttonRe }).first();
  const visible = await btn.isVisible().catch(() => false);
  if (visible) await btn.click();
  const resp = await respP;
  await page.waitForTimeout(1500);
  const body = resp ? await resp.text().catch(() => '') : '';
  const toast = await page.locator('[data-sonner-toast], [role="status"], [role="alert"]').allTextContents().catch(() => []);
  await page.screenshot({ path: `${OUT}/state-save-unchanged__${name}.png`, fullPage: false });
  console.log(JSON.stringify({ name, button: visible, status: resp?.status() ?? 'no request', body: body.slice(0, 260), toast: toast.join(' | ').slice(0, 200) }));
}
await saveUnchanged('onboarding', '/fr/dashboard/settings/onboarding', /Enregistrer/i, /\/api\/settings(\?|$)/);
await saveUnchanged('policies', '/fr/dashboard/settings/policies', /Enregistrer/i, /\/api\/settings\/values/);
await saveUnchanged('grading-policies', '/fr/dashboard/academics/grading/policies', /Enregistrer/i, /grading-policies/);

// Interaction states: open create forms / modals / validation
async function state(name, path, action) {
  await page.goto(H + path, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1000);
  try { await action(); } catch (e) { console.log(name, 'action failed', e.message.slice(0, 80)); }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/state__${name}.png`, fullPage: false });
  console.log(name, 'captured');
}
await state('academic-year-add-modal', '/fr/dashboard/academics/calendar', () => page.getByRole('button', { name: /Ajouter une année/i }).click());
await state('academic-year-add-validation', '/fr/dashboard/academics/calendar', async () => { await page.getByRole('button', { name: /Ajouter une année/i }).click(); await page.waitForTimeout(500); await page.getByRole('dialog').getByRole('button', { name: /Enregistrer|Créer|Ajouter/i }).last().click(); });
await state('semester-add-modal', '/fr/dashboard/academics/semesters', () => page.getByRole('button', { name: /Ajouter un semestre/i }).click());
await state('numbering-create-empty-validation', '/fr/dashboard/settings/numbering', () => page.getByRole('button', { name: /Créer la série/i }).click({ force: true }));
await state('custom-field-type-dropdown', '/fr/dashboard/settings/custom-fields', () => page.locator('select').nth(1).focus());
await state('grading-coefficients-tab', '/fr/dashboard/academics/grading/policies', () => page.getByRole('button', { name: /Coefficients par Filière/i }).click());
await state('entitlements-request-modal', '/fr/dashboard/settings/entitlements', () => page.getByRole('button', { name: /Demander un nouveau module/i }).click());
await state('security-page', '/fr/dashboard/settings/security', () => page.mouse.wheel(0, 400));
await browser.close();
