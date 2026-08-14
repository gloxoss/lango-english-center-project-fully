// verify-subscriptions.mjs — live verification of subscription & licensing
// (plan #4). Covers:
//   A. super-admin list (schools + summary + catalog)
//   B. school_admin denied on super-admin list (403)
//   C. school reads its own subscription detail
//   D. school renewal request (pending payment, validation 422)
//   E. school sees its own pending payment, Lango does NOT see it (isolation)
//   F. accountant denied on school subscription (403)
//   G. super-admin approves pending payment -> license issued + extended
//   H. second approve on same payment -> 409
//   I. super-admin per-school detail (license key + payments + addons)
//   J. issue with explicit expiresAt (Lango) + licenseKey shape
//   K. extend grows the expiry
//   L. revoke sets status cancelled
//   M. issue without months/expiresAt -> 422
//   N. cleanup
// Run: node scripts/verify-subscriptions.mjs  (dev server must be on :3002)
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';

const SUPER = { email: 'superadmin@schoolos.ma', password: 'Admin123!' };
const ADMIN = { email: 'admin2@atlas.ma', password: 'Admin123!' };
const LANGO_ADMIN = { email: 'admin@lango.ma', password: 'Admin123!' };
const ACCOUNTANT = { email: 'accountant@atlas.ma', password: 'Admin123!' };

const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';

let passed = 0;
let failed = 0;
const failures = [];
function check(name, ok, extra = '') {
  if (ok) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; failures.push(name); console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
}

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}
loadLocalEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos' });

class Jar {
  constructor() { this.cookies = new Map(); }
  setFrom(res) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...rest] = raw.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookies.set(name, { name, value, path: '/' });
    }
  }
  header(url) {
    return [...this.cookies.values()].map(c => `${c.name}=${c.value}`).join('; ');
  }
  clear() { this.cookies.clear(); }
}

async function req(jar, method, pathStr, body) {
  const url = `${BASE}${pathStr}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(jar ? { Cookie: jar.header(url) } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  jar?.setFrom(res);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, text };
}

const signIn = (jar, email, password) => req(jar, 'POST', '/api/auth/sign-in/email', { email, password });

async function dbQuery(text, params) {
  const r = await pool.query(text, params);
  return { rows: r.rows, rowCount: r.rowCount };
}
async function dbSelect(text, params) {
  return (await dbQuery(text, params)).rows;
}

async function run() {
  console.log('Subscription & licensing verification');
  console.log('======================================\n');

  const superJar = new Jar();
  const adminJar = new Jar();
  const langoJar = new Jar();
  const acctJar = new Jar();

  const s1 = await signIn(superJar, SUPER.email, SUPER.password);
  check(`superadmin sign-in ${s1.status}`, s1.status === 200, s1.text?.slice(0, 120));
  const s2 = await signIn(adminJar, ADMIN.email, ADMIN.password);
  check(`Atlas admin sign-in ${s2.status}`, s2.status === 200, s2.text?.slice(0, 120));
  const s3 = await signIn(langoJar, LANGO_ADMIN.email, LANGO_ADMIN.password);
  check(`Lango admin sign-in ${s3.status}`, s3.status === 200, s3.text?.slice(0, 120));
  const s4 = await signIn(acctJar, ACCOUNTANT.email, ACCOUNTANT.password);
  check(`accountant sign-in ${s4.status}`, s4.status === 200, s4.text?.slice(0, 120));

  // A. super-admin list
  const listRes = await req(superJar, 'GET', '/api/super-admin/subscriptions');
  const listData = listRes.json?.data;
  check('A. super-admin list 200', listRes.status === 200, `${listRes.status} ${listRes.text?.slice(0, 160)}`);
  check('A1. list includes Atlas', listData?.schools?.some(s => s.id === ATLAS), JSON.stringify(listData?.schools?.map(s => s.id)));
  check('A2. list includes Lango', listData?.schools?.some(s => s.id === LANGO));
  check('A3. summary.total matches schools length', listData?.summary?.total === listData?.schools?.length, JSON.stringify(listData?.summary));
  check('A4. catalog includes known addons', listData?.catalog?.some(c => c.addonId === 'hostel') && listData?.catalog?.some(c => c.addonId === 'multi-branch'));

  // B. school_admin denied on super-admin list
  const denied = await req(adminJar, 'GET', '/api/super-admin/subscriptions');
  check('B. school_admin 403 on super-admin list', denied.status === 403, `got ${denied.status}`);

  // C. school reads its own subscription detail
  const ownRes = await req(adminJar, 'GET', '/api/settings/subscription');
  const ownData = ownRes.json?.data;
  check('C. school subscription 200', ownRes.status === 200, `got ${ownRes.status} ${ownRes.text?.slice(0, 160)}`);
  check('C1. tenant is Atlas', ownData?.tenant?.id === ATLAS, `got ${ownData?.tenant?.id}`);
  check('C2. addons is an array', Array.isArray(ownData?.addons) && ownData.addons.length > 0);
  check('C3. payments is an array', Array.isArray(ownData?.payments));

  // D. school renewal request
  const reqRes = await req(adminJar, 'POST', '/api/settings/subscription/renewal-request', { months: 6, note: 'Test renewal' });
  const reqData = reqRes.json?.data;
  check(`D. renewal request 201 (got ${reqRes.status})`, reqRes.status === 201, reqRes.text?.slice(0, 160));
  check('D1. payment status pending', reqData?.status === 'pending', JSON.stringify(reqData));
  check('D2. requestedMonths 6', reqData?.requestedMonths === 6, JSON.stringify(reqData));
  check('D3. tenant Atlas', reqData?.tenantId === ATLAS, JSON.stringify(reqData?.tenantId));
  const atlasPaymentId = reqData?.id;
  const badMonths = await req(adminJar, 'POST', '/api/settings/subscription/renewal-request', { months: 0 });
  check('D4. months 0 rejected (422)', badMonths.status === 422, `got ${badMonths.status}`);
  const badMonths2 = await req(adminJar, 'POST', '/api/settings/subscription/renewal-request', { months: 40 });
  check('D5. months 40 rejected (422)', badMonths2.status === 422, `got ${badMonths2.status}`);

  // E. isolation: Atlas sees its pending, Lango does NOT
  const ownAfter = await req(adminJar, 'GET', '/api/settings/subscription');
  check('E. Atlas sees its pending payment', ownAfter.json?.data?.payments?.some(p => p.id === atlasPaymentId && p.status === 'pending'), JSON.stringify(ownAfter.json?.data?.payments?.map(p => p.id)));
  const langoOwn = await req(langoJar, 'GET', '/api/settings/subscription');
  check('E1. Lango does NOT see Atlas payment', !langoOwn.json?.data?.payments?.some(p => p.id === atlasPaymentId), JSON.stringify(langoOwn.json?.data?.payments?.map(p => p.id)));

  // F. accountant denied
  const acctOwn = await req(acctJar, 'GET', '/api/settings/subscription');
  check('F. accountant 403 on school subscription', acctOwn.status === 403, `got ${acctOwn.status}`);

  // G. super-admin approves the pending payment -> license issued
  const approveRes = await req(superJar, 'POST', `/api/super-admin/subscriptions/${ATLAS}/payments/${atlasPaymentId}/decision`, { approved: true, amount: 2400 });
  const approveData = approveRes.json?.data;
  check(`G. approve 200 (got ${approveRes.status})`, approveRes.status === 200, approveRes.text?.slice(0, 200));
  check('G1. payment status paid', approveData?.status === 'paid', JSON.stringify(approveData));
  check('G2. amount recorded', Number(approveData?.amount) === 2400, JSON.stringify(approveData?.amount));
  const atlasLicense = await dbSelect('SELECT * FROM school_licenses WHERE tenant_id = $1', [ATLAS]);
  check('G3. license row created for Atlas', atlasLicense.length === 1, `got ${atlasLicense.length}`);
  const licenseExpiry = atlasLicense[0]?.expires_at ? new Date(atlasLicense[0].expires_at) : null;
  const monthsOut = licenseExpiry
    ? Math.round((licenseExpiry.getTime() - Date.now()) / (30 * 24 * 3600 * 1000))
    : 0;
  check(`G4. expiry ~6 months out (got ${monthsOut})`, monthsOut >= 5 && monthsOut <= 7, `exp ${licenseExpiry}`);

  // H. second approve -> 409
  const reApprove = await req(superJar, 'POST', `/api/super-admin/subscriptions/${ATLAS}/payments/${atlasPaymentId}/decision`, { approved: true });
  check('H. re-approve 409', reApprove.status === 409, `got ${reApprove.status} ${reApprove.text?.slice(0, 120)}`);

  // I. per-school detail
  const detailRes = await req(superJar, 'GET', `/api/super-admin/subscriptions/${ATLAS}`);
  const detailData = detailRes.json?.data;
  check('I. per-school detail 200', detailRes.status === 200, `got ${detailRes.status}`);
  check('I1. license key present', /^SCHOOLOS-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/.test(detailData?.license?.licenseKey ?? ''), detailData?.license?.licenseKey);
  check('I2. detail shows the paid payment', detailData?.payments?.some(p => p.id === atlasPaymentId && p.status === 'paid'));
  check('I3. licenseStatus active', detailData?.licenseStatus === 'active', JSON.stringify(detailData?.licenseStatus));

  // J. issue with explicit expiresAt for Lango
  const issueRes = await req(superJar, 'POST', `/api/super-admin/subscriptions/${LANGO}/license`, { action: 'issue', expiresAt: '2027-01-01' });
  const issueData = issueRes.json?.data;
  check(`J. issue with expiresAt 200 (got ${issueRes.status})`, issueRes.status === 200, issueRes.text?.slice(0, 200));
  check('J1. Lango license key shape', /^SCHOOLOS-/.test(issueData?.licenseKey ?? ''), issueData?.licenseKey);
  check('J2. expiresAt = 2027-01-01', (issueData?.expiresAt ?? '').startsWith('2027-01-01'), JSON.stringify(issueData?.expiresAt));
  check('J3. status active', issueData?.status === 'active', JSON.stringify(issueData?.status));

  // K. extend grows expiry
  const beforeExp = atlasLicense[0]?.expires_at ? new Date(atlasLicense[0].expires_at).getTime() : 0;
  const extendRes = await req(superJar, 'POST', `/api/super-admin/subscriptions/${ATLAS}/license`, { action: 'extend', months: 12 });
  const extendData = extendRes.json?.data;
  const afterExp = extendData?.expiresAt ? new Date(extendData.expiresAt).getTime() : 0;
  check(`K. extend 200 (got ${extendRes.status})`, extendRes.status === 200, extendRes.text?.slice(0, 160));
  check('K1. expiry grows ~12 months', afterExp - beforeExp >= 11 * 30 * 24 * 3600 * 1000 && afterExp - beforeExp <= 13 * 31 * 24 * 3600 * 1000, `before ${beforeExp} after ${afterExp}`);
  check('K2. status still active', extendData?.status === 'active', JSON.stringify(extendData?.status));

  // L. revoke
  const revokeRes = await req(superJar, 'POST', `/api/super-admin/subscriptions/${LANGO}/license`, { action: 'revoke' });
  check(`L. revoke 200 (got ${revokeRes.status})`, revokeRes.status === 200, revokeRes.text?.slice(0, 160));
  check('L1. Lango license cancelled', revokeRes.json?.data?.status === 'cancelled', JSON.stringify(revokeRes.json?.data?.status));
  const langoList = await req(superJar, 'GET', '/api/super-admin/subscriptions');
  const langoRow = langoList.json?.data?.schools?.find(s => s.id === LANGO);
  check('L2. list shows Lango cancelled', langoRow?.licenseStatus === 'cancelled', JSON.stringify(langoRow?.licenseStatus));

  // M. issue without months/expiresAt -> 422
  const badIssue = await req(superJar, 'POST', `/api/super-admin/subscriptions/${ATLAS}/license`, { action: 'issue' });
  check('M. issue without months 422', badIssue.status === 422, `got ${badIssue.status}`);

  // N. cleanup: remove test license + payments for Atlas and Lango
  const delPay = await dbQuery('DELETE FROM license_payments WHERE tenant_id IN ($1, $2)', [ATLAS, LANGO]);
  const delLic = await dbQuery('DELETE FROM school_licenses WHERE tenant_id IN ($1, $2)', [ATLAS, LANGO]);
  check(`N. cleanup — removed ${delPay.rowCount} payment(s), ${delLic.rowCount} license(s)`, (delPay.rowCount ?? 0) + (delLic.rowCount ?? 0) >= 3, 'nothing to clean');

  await pool.end();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Failures:', failures.join(' | '));
    process.exit(1);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
