// Live acceptance verification — Phase 4: documents, access overview, one-time
// account linking, offboarding & reactivation. Hits the running dev server.
// Run: node scripts/verify-hr-phase4.mjs
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

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
  + '0000000d4944415478da63fcffcfff3f000505fe04f0a4cb870000000049454e44ae426082',
  'hex',
);

const run = async () => {
  const session = {};
  for (const [k, u] of Object.entries(USERS)) {
    const s = await signIn(u.email, PASSWORD);
    session[k] = s.cookie;
  }

  let emp1Id = null;   // full lifecycle subject
  let emp2Id = null;   // second employee for the double-link 409
  let candidateId = null;
  let docId = null;

  const mkEmployee = async (firstName) => {
    const r = await api(session.u1, '/api/hr/employees', {
      method: 'POST',
      body: {
        firstName, lastName: 'Test4', email: `${firstName.toLowerCase()}.test4@atlas.ma`,
        employmentType: 'permanent', employmentStatus: 'active', hireDate: '2026-08-01',
        nationalId: `CIN-${firstName}-0004`, salary: '9000.00',
      },
      expectStatus: 201,
    });
    return r.json?.data?.id ?? null;
  };

  // ---------- T8: documents ----------
  {
    emp1Id = await mkEmployee('Khalid');
    check('T8 setup: no-login employee created', !!emp1Id, `id ${emp1Id}`);

    const list0 = await api(session.u1, `/api/hr/employees/${emp1Id}/documents`);
    check('T8a documents list empty initially', list0.status === 200 && Array.isArray(list0.json?.data) && list0.json.data.length === 0,
      `status ${list0.status}`);

    const fd = new FormData();
    fd.append('documentType', 'cin');
    fd.append('issuedAt', '2024-01-15');
    fd.append('expiryDate', '2030-01-15');
    fd.append('file', new File([PNG], 'cin-khalid.png', { type: 'image/png' }));
    const up = await fetch(`${BASE}/api/hr/employees/${emp1Id}/documents`, {
      method: 'POST', headers: { Cookie: session.u1, Origin: ORIGIN }, body: fd, redirect: 'manual',
    });
    const upJson = await up.json().catch(() => ({}));
    docId = upJson?.data?.id ?? null;
    check('T8b upload PNG → 201 with metadata',
      up.status === 201 && !!docId && upJson?.data?.documentType === 'cin' && upJson?.data?.originalName === 'cin-khalid.png',
      `status ${up.status}, docId ${docId}`);

    const dl = await fetch(`${BASE}/api/hr/employees/${emp1Id}/documents/${docId}`, {
      headers: { Cookie: session.u1, Origin: ORIGIN }, redirect: 'manual',
    });
    const dlBuf = Buffer.from(await dl.arrayBuffer());
    const isPng = dlBuf.length >= 8 && dlBuf[0] === 0x89 && dlBuf[1] === 0x50 && dlBuf[2] === 0x4e && dlBuf[3] === 0x47;
    check('T8c download returns PNG bytes', dl.status === 200 && dl.headers.get('content-type') === 'image/png' && isPng,
      `content-type ${dl.headers.get('content-type')}, bytes ${dlBuf.length}`);

    const arch = await api(session.u1, `/api/hr/employees/${emp1Id}/documents/${docId}`, {
      method: 'PATCH', body: { archived: true },
    });
    check('T8d archive sets archivedAt', arch.status === 200 && !!arch.json?.data?.archivedAt, `status ${arch.status}`);
    const unarch = await api(session.u1, `/api/hr/employees/${emp1Id}/documents/${docId}`, {
      method: 'PATCH', body: { archived: false },
    });
    check('T8d2 unarchive clears archivedAt', unarch.status === 200 && unarch.json?.data?.archivedAt === null, `status ${unarch.status}`);

    const accList = await api(session.acc, `/api/hr/employees/${emp1Id}/documents`);
    check('T8e accountant blocked on documents (403)', accList.status === 403, `status ${accList.status}, code ${accList.json?.error?.code}`);

    const badFd = new FormData();
    badFd.append('documentType', 'cin');
    badFd.append('file', new File([Buffer.from('not-an-image')], 'evil.txt', { type: 'text/plain' }));
    const badUp = await fetch(`${BASE}/api/hr/employees/${emp1Id}/documents`, {
      method: 'POST', headers: { Cookie: session.u1, Origin: ORIGIN }, body: badFd, redirect: 'manual',
    });
    check('T8f disallowed mime type → 422', badUp.status === 422, `status ${badUp.status}`);
  }

  // ---------- T9: access overview + one-time linking ----------
  {
    const acc = await api(session.u1, '/api/hr/access');
    check('T9a access overview returns employees + candidates',
      acc.status === 200 && Array.isArray(acc.json?.data?.employees) && Array.isArray(acc.json?.data?.candidates),
      `status ${acc.status}`);

    const newUser = await api(session.u1, '/api/users', {
      method: 'POST', expectStatus: 200,
      body: { fullName: 'Rachid Berrada', email: 'rachid.test4@atlas.ma', phone: '+212600000004', role: 'Enseignant', status: 'Actif' },
    });
    candidateId = newUser.json?.data?.id ?? null;
    check('T9b candidate user created via /api/users', !!candidateId, `id ${candidateId}`);

    const acc2 = await api(session.u1, '/api/hr/access');
    const inCandidates = (acc2.json?.data?.candidates ?? []).some(c => c.id === candidateId);
    check('T9b2 candidate appears in access overview', acc2.status === 200 && inCandidates, `status ${acc2.status}`);

    const link = await api(session.u1, `/api/hr/employees/${emp1Id}/link-account`, {
      method: 'POST', body: { userId: candidateId },
    });
    check('T9c link-account sets userId on profile',
      link.status === 200 && link.json?.data?.userId === candidateId, `userId ${link.json?.data?.userId}`);

    const relink = await api(session.u1, `/api/hr/employees/${emp1Id}/link-account`, {
      method: 'POST', body: { userId: candidateId },
    });
    check('T9d re-link same employee → 409 ALREADY_LINKED',
      relink.status === 409 && relink.json?.error?.code === 'ALREADY_LINKED', `status ${relink.status}, code ${relink.json?.error?.code}`);

    emp2Id = await mkEmployee('Salma');
    const dbl = await api(session.u1, `/api/hr/employees/${emp2Id}/link-account`, {
      method: 'POST', body: { userId: candidateId },
    });
    check('T9e linking a user already linked elsewhere → 409 USER_ALREADY_LINKED',
      dbl.status === 409 && dbl.json?.error?.code === 'USER_ALREADY_LINKED', `status ${dbl.status}, code ${dbl.json?.error?.code}`);

    const ev = await api(session.u1, `/api/hr/employees/${emp1Id}/history`);
    check('T9f history records linked_account event',
      ev.status === 200 && (ev.json?.data ?? []).some(e => e.eventType === 'linked_account'), `status ${ev.status}`);

    const dbRow = await pool.query('SELECT user_id FROM employee_profiles WHERE id = $1', [emp1Id]);
    check('T9g DB evidence: profile.user_id = candidate',
      dbRow.rows[0]?.user_id === candidateId, `user_id=${dbRow.rows[0]?.user_id}`);
  }

  // ---------- T10: offboarding & reactivation ----------
  {
    const off = await api(session.u1, `/api/hr/employees/${emp1Id}/offboard`, {
      method: 'POST', body: { reason: 'Départ à la retraite' },
    });
    check('T10a offboard sets employmentStatus=offboarded',
      off.status === 200 && off.json?.data?.employmentStatus === 'offboarded', `status ${off.status}`);

    const userRow = await pool.query('SELECT user_status FROM "user" WHERE id = $1', [candidateId]);
    check('T10a2 offboard disables linked account (user_status=inactive)',
      userRow.rows[0]?.user_status === 'inactive', `user_status=${userRow.rows[0]?.user_status}`);

    const off2 = await api(session.u1, `/api/hr/employees/${emp1Id}/offboard`, {
      method: 'POST', body: { reason: 'again' },
    });
    check('T10b double offboard → 409 ALREADY_OFFBOARDED',
      off2.status === 409 && off2.json?.error?.code === 'ALREADY_OFFBOARDED', `status ${off2.status}`);

    const re = await api(session.u1, `/api/hr/employees/${emp1Id}/reactivate`, {
      method: 'POST', body: { reason: 'Réintégration' },
    });
    check('T10c reactivate sets employmentStatus=active',
      re.status === 200 && re.json?.data?.employmentStatus === 'active', `status ${re.status}`);

    const userRow2 = await pool.query('SELECT user_status FROM "user" WHERE id = $1', [candidateId]);
    check('T10c2 reactivate re-enables linked account (user_status=active)',
      userRow2.rows[0]?.user_status === 'active', `user_status=${userRow2.rows[0]?.user_status}`);

    const hist = await api(session.u1, `/api/hr/employees/${emp1Id}/history`);
    const types = (hist.json?.data ?? []).map(e => e.eventType);
    check('T10d timeline records offboarded + reactivated events',
      hist.status === 200 && types.includes('offboarded') && types.includes('reactivated'), types.join(', '));

    const cross = await api(session.lango, `/api/hr/employees/${emp1Id}/offboard`, { method: 'POST', body: { reason: 'x' } });
    check('T10e cross-tenant offboard → 404 (tenant isolation)',
      cross.status === 404, `status ${cross.status}, code ${cross.json?.error?.code}`);

    const accOff = await api(session.acc, `/api/hr/employees/${emp1Id}/offboard`, { method: 'POST', body: { reason: 'x' } });
    check('T10f offboard requires hr.access.manage → accountant 403',
      accOff.status === 403, `status ${accOff.status}, code ${accOff.json?.error?.code}`);

    const notOff = await api(session.u1, `/api/hr/employees/${emp1Id}/reactivate`, { method: 'POST', body: {} });
    check('T10g reactivate of active employee → 409 NOT_OFFBOARDED',
      notOff.status === 409 && notOff.json?.error?.code === 'NOT_OFFBOARDED', `status ${notOff.status}, code ${notOff.json?.error?.code}`);
  }

  // ---------- Cleanup ----------
  {
    await pool.query('DELETE FROM employee_documents WHERE employee_id = ANY($1)', [[emp1Id, emp2Id]]);
    await pool.query('DELETE FROM employee_employment_events WHERE employee_id = ANY($1)', [[emp1Id, emp2Id]]);
    await pool.query('DELETE FROM employee_profiles WHERE id = ANY($1)', [[emp1Id, emp2Id]]);
    await pool.query('DELETE FROM "user" WHERE id = $1', [candidateId]);
    console.log('cleanup done');
  }

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
