// Settings permission + tenant isolation probe (server-side only; no UI).
const H = process.env.BASE ?? 'http://localhost:3111';
const ids = JSON.parse(process.env.IDS);
const users = {
  atlasAdmin: 'y.elamrani@atlas.ma', teacher: 'prof.20@atlas.ma', receptionist: 'accueil@atlas.ma',
  accountant: 'accountant@atlas.ma', langoAdmin: 'admin@lango.ma',
};
async function login(email) {
  const r = await fetch(`${H}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: H }, body: JSON.stringify({ email, password: 'Admin123!' }) });
  return r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
}
const cookies = {};
for (const [k, e] of Object.entries(users)) cookies[k] = await login(e);

const call = async (who, method, path, body) => {
  const r = await fetch(H + path, { method, headers: { Cookie: cookies[who], 'Content-Type': 'application/json', Origin: H }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};

const reads = ['/api/settings', '/api/settings/values', '/api/settings/branches', '/api/settings/custom-fields', '/api/settings/numbering',
  '/api/settings/providers', '/api/settings/addons', '/api/settings/permissions', '/api/academics/session-years', '/api/academics/semesters',
  '/api/academics/grading-policies', '/api/settings/security/login-events', '/api/settings/scheduled-jobs', '/api/settings/values/accounting.defaults',
  '/api/settings/cndp-filing', '/api/settings/subscription', '/api/audit-logs', '/api/users'];
const out = { reads: [], crossTenant: [], roleWrites: [] };
for (const p of reads) {
  const row = { path: p };
  for (const who of Object.keys(users)) row[who] = (await call(who, 'GET', p)).status;
  // Does the Lango admin's answer contain any Atlas identifier?
  const lango = await call('langoAdmin', 'GET', p);
  row.langoSeesAtlasIds = JSON.stringify(lango.json ?? '').match(new RegExp([ids.atlas_tid, ids.cf, ids.ns, ids.sy, ids.sem, ids.br].join('|'))) ? 'LEAK' : 'no';
  out.reads.push(row);
}
const MARK = 'ISOLATION-PROBE';
const cross = [
  ['PATCH', `/api/settings/custom-fields/${ids.cf}`, { label: MARK }],
  ['GET', `/api/settings/custom-fields/${ids.cf}`],
  ['PATCH', `/api/settings/numbering/${ids.ns}`, { name: MARK }],
  ['GET', `/api/settings/numbering/${ids.ns}`],
  ['PUT', '/api/academics/session-years', { id: ids.sy, name: MARK, startDate: '2026-09-01', endDate: '2027-06-30' }],
  ['PUT', '/api/academics/semesters', { id: ids.sem, name: MARK, startMonth: 9, endMonth: 1 }],
  ['PUT', `/api/settings/branches/${ids.br}`, { name: MARK }],
  ['DELETE', `/api/settings/custom-fields/${ids.cf}`],
  ['DELETE', `/api/academics/semesters?id=${ids.sem}`],
  ['DELETE', `/api/settings/branches/${ids.br}`],
];
for (const [m, p, b] of cross) { const r = await call('langoAdmin', m, p, b); out.crossTenant.push({ method: m, path: p, status: r.status, code: r.json?.error?.code ?? (r.json?.success ? 'SUCCESS' : '') }); }
const roleWrites = [
  ['teacher', 'PATCH', '/api/settings/values/academic.passThreshold', { value: 10 }],
  ['receptionist', 'POST', '/api/settings', { establishmentName: MARK }],
  ['accountant', 'PUT', '/api/academics/grading-policies', { passThreshold: 10 }],
  ['teacher', 'POST', '/api/academics/session-years', { name: MARK, startDate: '2030-09-01', endDate: '2031-06-30' }],
  ['accountant', 'POST', '/api/settings/custom-fields', { key: 'probe', label: MARK, entityType: 'student', fieldType: 'text' }],
];
for (const [who, m, p, b] of roleWrites) { const r = await call(who, m, p, b); out.roleWrites.push({ who, method: m, path: p, status: r.status, code: r.json?.error?.code ?? (r.json?.success ? 'SUCCESS' : '') }); }
console.log(JSON.stringify(out, null, 1));
