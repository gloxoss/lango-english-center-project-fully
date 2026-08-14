// Live acceptance verification — Phase 5: overview, CSV export, sensitive
// redaction matrix and addon-disable regression. Hits the running dev server.
// Run: node scripts/verify-hr-phase5.mjs
import { Pool } from 'pg';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  const setCookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const body = await res.json().catch(() => ({}));
  if (!setCookies) throw new Error(`sign-in for ${email} returned no cookie (${res.status} ${JSON.stringify(body).slice(0, 200)})`);
  return { cookie: setCookies };
}

async function api(cookie, path, { method = 'GET', body, expectStatus } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: ORIGIN },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`${method} ${path} expected ${expectStatus}, got ${res.status}: ${text.slice(0, 300)}`);
  }
  return { status: res.status, json, text, res };
}

const USERS = {
  u1: { id: 'USR-001', email: 'y.elamrani@atlas.ma' },        // school_admin, Atlas
  lango: { id: 'USR-LANGO-001', email: 'admin@lango.ma' },     // school_admin, Lango
  acc: { id: 'USR-ACC-001', email: 'accountant@atlas.ma' },    // accountant, Atlas
};
const PASSWORD = 'Admin123!';
const SENSITIVE_KEYS = ['salary', 'nationalId', 'bankRib', 'cnssNumber', 'amoNumber', 'contractType'];

const profileCount = async (tenantId) => {
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM employee_profiles WHERE tenant_id = $1', [tenantId]);
  return r.rows[0].n;
};

const csvDataRows = (text) => {
  const lines = text.replace(/^﻿/, '').split('\n').filter((l) => l.trim().length > 0);
  return { header: lines[0] ?? '', dataRows: lines.slice(1) };
};

const run = async () => {
  const session = {};
  for (const [k, u] of Object.entries(USERS)) {
    const s = await signIn(u.email, PASSWORD);
    session[k] = s.cookie;
  }

  const atlasCount = await profileCount(ATLAS);
  const langoCount = await profileCount(LANGO);

  // ---------- Overview: shape + sensitive gating ----------
  let overrideId = null;
  {
    const ov = await api(session.u1, '/api/hr/overview');
    const d = ov.json?.data;
    check('OV1 overview 200 with headcount/hires/departures/expiring',
      ov.status === 200 && !!d && typeof d.headcount?.total === 'number' && d.headcount.total > 0
        && typeof d.hiresThisMonth === 'number' && typeof d.departuresThisMonth === 'number'
        && typeof d.unlinkedAccounts === 'number' && Array.isArray(d.expiringDocuments),
      ov.status === 200 ? `total=${d?.headcount?.total}, hires=${d?.hiresThisMonth}` : `status ${ov.status}`);
    check('OV1b headcount.total matches DB for atlas',
      d?.headcount?.total === atlasCount, `api=${d?.headcount?.total}, db=${atlasCount}`);
    check('OV1c salaryTotal present for sensitive-permitted caller',
      ov.status === 200 && typeof d?.salaryTotal === 'string' && Number.isFinite(Number(d.salaryTotal)),
      `salaryTotal=${d?.salaryTotal}`);

    // Revoke hr.sensitive.read for u1 → salaryTotal must disappear.
    const ins = await pool.query(
      `INSERT INTO user_permission_overrides (tenant_id, user_id, permission_id, granted)
       VALUES ($1, $2, 'hr.sensitive.read', false) RETURNING id`,
      [ATLAS, USERS.u1.id],
    );
    overrideId = ins.rows[0]?.id ?? null;

    const ovR = await api(session.u1, '/api/hr/overview');
    check('OV2 salaryTotal ABSENT when hr.sensitive.read revoked',
      ovR.status === 200 && !('salaryTotal' in (ovR.json?.data ?? {})),
      `status ${ovR.status}, keys=${Object.keys(ovR.json?.data ?? {}).join(',')}`);

    if (overrideId) await pool.query('DELETE FROM user_permission_overrides WHERE id = $1', [overrideId]);
    overrideId = null;

    const ovL = await api(session.lango, '/api/hr/overview');
    check('OV3 tenant isolation: lango overview reflects lango DB',
      ovL.status === 200 && ovL.json?.data?.headcount?.total === langoCount,
      `api=${ovL.json?.data?.headcount?.total}, db=${langoCount}`);
  }

  // ---------- Export: CSV shape, sensitive columns, tenant boundary ----------
  {
    const ex = await api(session.u1, '/api/hr/export');
    const { header, dataRows } = csvDataRows(ex.text);
    const hasSensitiveHeader = SENSITIVE_KEYS.every((k) => header.includes(k));
    check('EX1 export 200 CSV with sensitive columns for permitted caller',
      ex.status === 200 && ex.res.headers.get('content-type')?.startsWith('text/csv')
        && hasSensitiveHeader && header.includes('employeeId') && header.includes('department'),
      `status ${ex.status}, rows=${dataRows.length}, sensitiveHeaders=${hasSensitiveHeader}`);
    check('EX1b export row count matches atlas DB count',
      dataRows.length === atlasCount, `csv=${dataRows.length}, db=${atlasCount}`);

    const ov2 = await pool.query(
      `INSERT INTO user_permission_overrides (tenant_id, user_id, permission_id, granted)
       VALUES ($1, $2, 'hr.sensitive.read', false) RETURNING id`,
      [ATLAS, USERS.u1.id],
    );
    overrideId = ov2.rows[0]?.id ?? null;

    const exR = await api(session.u1, '/api/hr/export');
    const { header: hR, dataRows: rowsR } = csvDataRows(exR.text);
    const sensitiveAbsent = SENSITIVE_KEYS.every((k) => !hR.includes(k));
    check('EX2 sensitive columns ABSENT when hr.sensitive.read revoked',
      exR.status === 200 && sensitiveAbsent && hR.includes('employeeId') && rowsR.length === atlasCount,
      `sensitiveAbsent=${sensitiveAbsent}, rows=${rowsR.length}`);

    if (overrideId) await pool.query('DELETE FROM user_permission_overrides WHERE id = $1', [overrideId]);
    overrideId = null;

    const exAcc = await api(session.acc, '/api/hr/export');
    check('EX3 accountant blocked on export (403, no hr.export)',
      exAcc.status === 403, `status ${exAcc.status}, code ${exAcc.json?.error?.code}`);

    const exL = await api(session.lango, '/api/hr/export');
    const { dataRows: rowsL } = csvDataRows(exL.text);
    check('EX4 lango export row count matches lango DB count (tenant boundary)',
      exL.status === 200 && rowsL.length === langoCount, `csv=${rowsL.length}, db=${langoCount}`);
  }

  // ---------- Addon-disable regression ----------
  {
    const off = await api(session.u1, '/api/settings/addons/human-resources', {
      method: 'PATCH', body: { active: false }, expectStatus: 200,
    });
    check('ADDON1 school_admin disables HR addon', off.status === 200, `msg ${off.json?.message ?? ''}`);

    const ovOff = await api(session.u1, '/api/hr/overview');
    check('ADDON2 overview → 403 ADDON_NOT_ACTIVATED when disabled',
      ovOff.status === 403 && ovOff.json?.error?.code === 'ADDON_NOT_ACTIVATED',
      `status ${ovOff.status}, code ${ovOff.json?.error?.code}`);

    const exOff = await api(session.u1, '/api/hr/export');
    check('ADDON3 export → 403 ADDON_NOT_ACTIVATED when disabled',
      exOff.status === 403 && exOff.json?.error?.code === 'ADDON_NOT_ACTIVATED',
      `status ${exOff.status}, code ${exOff.json?.error?.code}`);

    const users = await api(session.u1, '/api/users');
    check('ADDON4 core /api/users still 200 when HR addon disabled',
      users.status === 200, `status ${users.status}`);

    const on = await api(session.u1, '/api/settings/addons/human-resources', {
      method: 'PATCH', body: { active: true }, expectStatus: 200,
    });
    check('ADDON5 school_admin re-enables HR addon', on.status === 200, `msg ${on.json?.message ?? ''}`);

    const ovOn = await api(session.u1, '/api/hr/overview');
    check('ADDON6 overview data visible again after re-enable',
      ovOn.status === 200 && typeof ovOn.json?.data?.headcount?.total === 'number', `status ${ovOn.status}`);

    const empOn = await api(session.u1, '/api/hr/employees');
    check('ADDON7 employee directory visible again after re-enable',
      empOn.status === 200 && Array.isArray(empOn.json?.data), `status ${empOn.status}`);
  }

  // ---------- Cleanup ----------
  if (overrideId) await pool.query('DELETE FROM user_permission_overrides WHERE id = $1', [overrideId]);

  const failed = results.filter(x => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('Failed:');
    failed.forEach(f => console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ''}`));
  }
  await pool.end();
  process.exit(failed.length ? 1 : 0);
};

run().catch(async (err) => {
  console.error('FATAL', err);
  await pool.end();
  process.exit(1);
});
