// Audit-database helper: signs in as the seeded super admin, completes the
// mandatory TOTP enrolment (codes computed locally, RFC 6238), saves the
// secret for later sweeps, then enables add-ons through the real super-admin
// API. Intended ONLY for the isolated schoolos_audit database.
// Usage: node scripts/audit-superadmin-setup.mjs <tenantId> <secretFile> [addonId ...]
import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:3222';
const EMAIL = process.env.SUPER_EMAIL ?? 'superadmin@schoolos.ma';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Admin123!';
const [tenantId, secretFile, ...addons] = process.argv.slice(2);

export function totp(base32Secret, step = 30, digits = 6) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of base32Secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / step)));
  const h = crypto.createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h.readUInt32BE(o) & 0x7fffffff) % 10 ** digits);
  return String(n).padStart(digits, '0');
}

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(`${BASE}/fr/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
const api = (path, body) => page.evaluate(async ([p, b]) => {
  const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  return { status: r.status, json: await r.json().catch(() => null) };
}, [path, body]);

const signIn = await api('/api/auth/sign-in/email', { email: EMAIL, password: PASSWORD });
console.log('sign-in', signIn.status, signIn.json?.twoFactorRedirect ? '(2FA challenge)' : '');

let secret = fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8').trim() : null;
if (signIn.json?.twoFactorRedirect) {
  if (!secret) throw new Error('2FA already enabled but no saved secret');
  const v = await api('/api/auth/two-factor/verify-totp', { code: totp(secret) });
  console.log('verify-totp (login)', v.status);
} else {
  const en = await api('/api/auth/two-factor/enable', { password: PASSWORD });
  const uri = en.json?.totpURI;
  if (!uri) throw new Error(`enable failed: ${en.status} ${JSON.stringify(en.json)}`);
  secret = new URL(uri).searchParams.get('secret');
  fs.writeFileSync(secretFile, secret);
  const v = await api('/api/auth/two-factor/verify-totp', { code: totp(secret) });
  console.log('enable', en.status, 'verify-totp (enrol)', v.status);
}

for (const addonId of addons) {
  const r = await api('/api/super-admin/entitlements', { tenantId, addonId, isEnabled: true, note: 'Audit: enabled by super admin' });
  console.log('enable addon', addonId, r.status, r.json?.error?.message ?? '');
}
await browser.close();
