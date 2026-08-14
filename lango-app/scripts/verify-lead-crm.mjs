// Live acceptance verification for Lead CRM (Phase 2 backend).
// Hits the running dev server (:3002) with real sessions + verifies real DB rows.
// Run: node scripts/verify-lead-crm.mjs
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3002';
const ORIGIN = 'http://localhost:3000';
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
  return { cookie: setCookies, body };
}

async function api(cookie, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: ORIGIN },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

const PASSWORD = 'Admin123!';
const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';
const runId = randomUUID().slice(0, 8);
const mark = `[verify-${runId}]`;

const run = async () => {
  const admin = await signIn('y.elamrani@atlas.ma', PASSWORD); // Atlas school_admin
  const langoAdmin = await signIn('admin@lango.ma', PASSWORD); // Lango school_admin
  console.log('→ signed in as Atlas admin and Lango admin\n');

  // Cleanup of previous-run leftovers (inquiries + their applicants + follow-ups)
  await pool.query(
    `DELETE FROM applicants WHERE tenant_id=$1 AND email LIKE 'prospect-______@lango.local'
       AND EXISTS (SELECT 1 FROM inquiries i WHERE i.converted_applicant_id = applicants.id AND i.contact_name LIKE '%[verify%')`,
    [ATLAS],
  );
  await pool.query(
    `DELETE FROM inquiry_follow_ups WHERE tenant_id=$1 AND inquiry_id IN
       (SELECT id FROM inquiries WHERE tenant_id=$1 AND contact_name LIKE '%[verify%')`, [ATLAS],
  );
  await pool.query(`DELETE FROM inquiries WHERE tenant_id=$1 AND contact_name LIKE '%[verify%'`, [ATLAS]);

  const { rows: staffRows } = await pool.query(
    `SELECT id FROM "user" WHERE tenant_id=$1 AND role='school_admin' ORDER BY created_at LIMIT 1`, [ATLAS],
  );
  const staffId = staffRows[0]?.id;
  if (!staffId) throw new Error('No Atlas school_admin user found for assignment test');
  console.log(`→ using Atlas staff id ${staffId}\n`);

  let r;
  const ids = { a: null, b: null, c: null, primaryId: null, secondaryId: null };

  // ----------------------------------------------------------------- create + tags + source
  r = await api(admin.cookie, '/api/crm/inquiries', {
    method: 'POST',
    body: {
      contactName: `Amina Test ${mark}`,
      phone: '+212 6 10 00 00 01',
      email: `amina.${runId}@verify.ma`,
      source: 'facebook_ads',
      interestLevel: 'high',
      notes: 'Prospect publicité Facebook',
      assignedToId: staffId,
      tags: ['urgent', 'ads'],
    },
  });
  check('POST inquiry → 201', r.status === 201, `status ${r.status}`);
  ids.a = r.json?.data?.id;
  check('POST inquiry returns id', Boolean(ids.a), ids.a ?? '');
  check('POST inquiry stores tags + fb source', Array.isArray(r.json?.data?.tags) && r.json?.data?.tags.includes('ads') && r.json?.data?.source === 'facebook_ads',
    `tags ${JSON.stringify(r.json?.data?.tags)} source ${r.json?.data?.source}`);
  check('POST inquiry assigns owner', r.json?.data?.assignedToId === staffId, `assignedToId ${r.json?.data?.assignedToId}`);

  // second lead with same phone (duplicate of A), third with same email (duplicate of A)
  r = await api(admin.cookie, '/api/crm/inquiries', {
    method: 'POST', body: { contactName: `Brahim Dup ${mark}`, phone: '+212 6 10 00 00 01', source: 'walk_in', tags: ['ads'] },
  });
  ids.b = r.json?.data?.id;
  r = await api(admin.cookie, '/api/crm/inquiries', {
    method: 'POST', body: { contactName: `Carla Dup ${mark}`, email: `amina.${runId}@verify.ma`, source: 'web', tags: ['ads'] },
  });
  ids.c = r.json?.data?.id;
  check('created two duplicate candidates', Boolean(ids.b) && Boolean(ids.c), `${ids.b} ${ids.c}`);

  // ----------------------------------------------------------------- list + search + filter + total
  r = await api(admin.cookie, `/api/crm/inquiries?q=${encodeURIComponent(mark)}&pageSize=50`);
  check('GET list with search finds 3', r.status === 200 && r.json?.total === 3 && r.json?.data?.length === 3,
    `total ${r.json?.total}`);
  check('GET list returns pipeline counts', r.json?.counts && typeof r.json?.counts.new === 'number', JSON.stringify(r.json?.counts));

  r = await api(admin.cookie, `/api/crm/inquiries?tag=urgent&pageSize=50`);
  check('GET filter by tag=urgent → only A', r.status === 200 && r.json?.data?.length === 1 && r.json?.data?.[0]?.id === ids.a,
    `count ${r.json?.data?.length}`);

  r = await api(admin.cookie, `/api/crm/inquiries?source=facebook_ads&pageSize=50`);
  check('GET filter by source=facebook_ads → only A', r.status === 200 && r.json?.data?.length === 1 && r.json?.data?.[0]?.id === ids.a,
    `count ${r.json?.data?.length}`);

  r = await api(admin.cookie, `/api/crm/inquiries?assignedToId=${staffId}&pageSize=50`);
  check('GET filter by assignedToId → includes A', r.status === 200 && r.json?.data?.some((x) => x.id === ids.a), `count ${r.json?.data?.length}`);

  r = await api(admin.cookie, '/api/crm/inquiries?pageSize=2&page=1');
  check('GET pagination pageSize=2 returns ≤2 rows', r.status === 200 && r.json?.data?.length <= 2 && r.json?.page === 1 && r.json?.pageSize === 2,
    `len ${r.json?.data?.length}`);

  // ---------------------------------------------------------------- GET [id] + PATCH update/assign
  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}`);
  check('GET [id] returns assignedTo name', r.status === 200 && r.json?.data?.id === ids.a && r.json?.data?.assignedTo?.name,
    `assignedTo ${JSON.stringify(r.json?.data?.assignedTo)}`);

  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}`, {
    method: 'PATCH', body: { interestLevel: 'medium', notes: 'relancé par téléphone', tags: ['urgent', 'appointment'] },
  });
  check('PATCH update fields → 200', r.status === 200 && r.json?.data?.interestLevel === 'medium' && r.json?.data?.tags?.includes('appointment'),
    `status ${r.status}`);

  // ------------------------------------------------------------ transitions validation
  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}`, { method: 'PATCH', body: { status: 'contacted' } });
  check('transition new→contacted → 200', r.status === 200 && r.json?.data?.status === 'contacted', `status ${r.status}`);
  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}`, { method: 'PATCH', body: { status: 'qualified' } });
  check('transition contacted→qualified → 200', r.status === 200 && r.json?.data?.status === 'qualified', `status ${r.status}`);
  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}`, { method: 'PATCH', body: { status: 'converted' } });
  check('PATCH → converted rejected (USE_CONVERT_ENDPOINT)', r.status === 422 && r.json?.error?.code === 'USE_CONVERT_ENDPOINT',
    `status ${r.status} code ${r.json?.error?.code}`);
  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}`, { method: 'PATCH', body: { status: 'new' } });
  check('illegal qualified→new transition → 422 INVALID_TRANSITION', r.status === 422 && r.json?.error?.code === 'INVALID_TRANSITION',
    `status ${r.status} code ${r.json?.error?.code}`);

  // ---------------------------------------------------------------------- duplicates
  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}/duplicates`);
  check('GET duplicates finds B (same phone) + C (same email)', r.status === 200 && r.json?.data?.length === 2 &&
    r.json?.data?.some((x) => x.id === ids.b) && r.json?.data?.some((x) => x.id === ids.c),
    `count ${r.json?.data?.length}`);

  // ------------------------------------------------------------------------ follow-ups
  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}/follow-ups`, {
    method: 'POST', body: { type: 'call', notes: 'Premier appel, très intéressé', scheduledFor: '2026-08-10T10:00:00.000Z' },
  });
  check('POST follow-up → 201', r.status === 201 && r.json?.data?.type === 'call', `status ${r.status}`);
  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}/follow-ups`);
  check('GET follow-ups lists entry with creator name', r.status === 200 && r.json?.data?.length === 1 && r.json?.data?.[0]?.createdByName,
    `len ${r.json?.data?.length}`);
  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}/follow-ups`, { method: 'POST', body: { type: 'bad', notes: 'x' } });
  check('POST follow-up invalid type → 422 VALIDATION_ERROR', r.status === 422 && r.json?.error?.code === 'VALIDATION_ERROR', `status ${r.status} code ${r.json?.error?.code}`);

  // ------------------------------------------------------------------------- merge
  r = await api(admin.cookie, '/api/crm/inquiries', {
    method: 'POST', body: { contactName: `Primary Merge ${mark}`, phone: '+212 6 20 00 00 00', source: 'phone', tags: ['primary'] },
  });
  ids.primaryId = r.json?.data?.id;
  r = await api(admin.cookie, '/api/crm/inquiries', {
    method: 'POST', body: { contactName: `Secondary Merge ${mark}`, phone: '+212 6 20 00 00 00', source: 'web', tags: ['secondary', 'extra'] },
  });
  ids.secondaryId = r.json?.data?.id;
  await api(admin.cookie, `/api/crm/inquiries/${ids.secondaryId}/follow-ups`, {
    method: 'POST', body: { type: 'note', notes: 'note appartenant à la secondaire' },
  });

  r = await api(admin.cookie, '/api/crm/inquiries/merge', {
    method: 'POST', body: { primaryId: ids.primaryId, secondaryIds: [ids.secondaryId] },
  });
  check('POST merge → 200', r.status === 200, `status ${r.status}`);
  check('merge unions tags', Array.isArray(r.json?.data?.tags) && r.json?.data?.tags.includes('primary') && r.json?.data?.tags.includes('extra'),
    `tags ${JSON.stringify(r.json?.data?.tags)}`);

  r = await api(admin.cookie, `/api/crm/inquiries/${ids.secondaryId}`);
  check('merged secondary now 404', r.status === 404, `status ${r.status}`);
  r = await api(admin.cookie, `/api/crm/inquiries/${ids.primaryId}/follow-ups`);
  check('follow-up re-pointed to primary', r.status === 200 && r.json?.data?.length === 1 && r.json?.data?.[0]?.notes?.includes('secondaire'),
    `len ${r.json?.data?.length}`);

  // ------------------------------------------------------------- convert + idempotency
  r = await api(admin.cookie, '/api/admissions/inquiries/convert', {
    method: 'POST', body: { inquiryId: ids.a },
  });
  check('convert inquiry → 200 + applicant', r.status === 200 && r.json?.data?.applicant?.id, `status ${r.status}`);
  const applicantId = r.json?.data?.applicant?.id;
  check('convert sets inquiry status converted', r.json?.data?.inquiryId === ids.a, `inquiryId ${r.json?.data?.inquiryId}`);

  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}`);
  check('converted inquiry status + convertedApplicantId', r.status === 200 && r.json?.data?.status === 'converted' && r.json?.data?.convertedApplicantId === applicantId,
    `status ${r.json?.data?.status}`);

  r = await api(admin.cookie, '/api/admissions/inquiries/convert', {
    method: 'POST', body: { inquiryId: ids.a },
  });
  check('convert again → 422 ALREADY_CONVERTED (idempotent)', r.status === 422 && r.json?.error?.code === 'ALREADY_CONVERTED',
    `status ${r.status} code ${r.json?.error?.code}`);

  r = await api(admin.cookie, `/api/crm/inquiries/${ids.a}`, { method: 'DELETE' });
  check('DELETE converted inquiry → 422 CONVERTED_CANNOT_DELETE', r.status === 422 && r.json?.error?.code === 'CONVERTED_CANNOT_DELETE',
    `status ${r.status} code ${r.json?.error?.code}`);

  // ------------------------------------------------------------- cross-tenant isolation
  r = await api(langoAdmin.cookie, `/api/crm/inquiries/${ids.a}`);
  check('cross-tenant GET [id] → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, `/api/crm/inquiries/${ids.b}`, { method: 'PATCH', body: { notes: 'pirate' } });
  check('cross-tenant PATCH → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, `/api/crm/inquiries/${ids.b}`, { method: 'DELETE' });
  check('cross-tenant DELETE → 404', r.status === 404, `status ${r.status}`);
  r = await api(langoAdmin.cookie, '/api/crm/inquiries/merge', {
    method: 'POST', body: { primaryId: ids.primaryId, secondaryIds: [ids.b] },
  });
  check('cross-tenant merge (secondary in other tenant) → 404', r.status === 404, `status ${r.status}`);

  // ------------------------------------------------------------------ pipeline counts
  r = await api(admin.cookie, '/api/crm/inquiries?pageSize=1');
  const counts = r.json?.counts;
  check('pipeline counts reflect converted+new states', typeof counts?.converted === 'number' && counts?.converted >= 1,
    JSON.stringify(counts));

  // ------------------------------------------------------------- forbidden-field projection
  const forbidden = ['guardianId', 'studentId', 'financeBalance', 'salary', 'nationalId', 'privateNote'];
  const leak = forbidden.filter((k) => Object.prototype.hasOwnProperty.call(r.json?.data?.[0] ?? {}, k));
  check('no forbidden fields leak into inquiry projections', leak.length === 0, `leaked ${leak.join(',') || 'none'}`);

  // --------------------------------------------------------------- DB evidence
  const { rows: dbInq } = await pool.query(
    `SELECT id, status, tags, converted_applicant_id FROM inquiries WHERE tenant_id=$1 AND id=$2`, [ATLAS, ids.a],
  );
  check('DB: inquiry A converted + tags stored', dbInq[0]?.status === 'converted' && Array.isArray(dbInq[0]?.tags),
    JSON.stringify(dbInq[0]));

  const { rows: dbApp } = await pool.query(
    `SELECT id FROM applicants WHERE tenant_id=$1 AND id=$2`, [ATLAS, applicantId],
  );
  check('DB: applicant row created by conversion', dbApp.length === 1, `count ${dbApp.length}`);

  const { rows: dbFollow } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inquiry_follow_ups WHERE tenant_id=$1 AND inquiry_id=$2`, [ATLAS, ids.primaryId],
  );
  check('DB: follow-up re-pointed to merged primary', dbFollow[0]?.c === 1, `count ${dbFollow[0]?.c}`);

  const { rows: dbAudit } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM audit_logs WHERE tenant_id=$1 AND entity_type IN ('inquiry','applicant_conversion','inquiry_follow_up','inquiry_merge') AND entity_id IN ($2,$3,$4)`,
    [ATLAS, ids.a, ids.primaryId, applicantId],
  );
  check('DB: audit rows recorded for CRM mutations', dbAudit[0]?.c >= 3, `count ${dbAudit[0]?.c}`);

  const { rows: langoCount } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM inquiries WHERE tenant_id=$1 AND contact_name LIKE '%[verify%'`, [LANGO],
  );
  check('DB: Lango tenant untouched by CRM verify', langoCount[0]?.c === 0, `count ${langoCount[0]?.c}`);

  // -------------------------------------------------------------------------- cleanup
  await pool.query(
    `DELETE FROM applicants WHERE tenant_id=$1 AND id=$2`, [ATLAS, applicantId],
  );
  await pool.query(
    `DELETE FROM inquiry_follow_ups WHERE tenant_id=$1 AND inquiry_id IN
       (SELECT id FROM inquiries WHERE tenant_id=$1 AND contact_name LIKE '%[verify%')`, [ATLAS],
  );
  await pool.query(`DELETE FROM inquiries WHERE tenant_id=$1 AND contact_name LIKE '%[verify%'`, [ATLAS]);

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await pool.end();
  process.exit(failed.length ? 1 : 0);
};

run().catch((err) => { console.error('FATAL', err); process.exit(1); });
