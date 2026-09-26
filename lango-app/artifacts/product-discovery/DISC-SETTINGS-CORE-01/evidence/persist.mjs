// Save -> reload -> DB -> restore round trips as the Atlas director.
import { execSync } from 'node:child_process';

const H = 'http://localhost:3111';
const ids = JSON.parse(process.env.IDS);
const sql = q => execSync(`docker exec schoolos-db psql -U schoolos -d schoolos -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const r0 = await fetch(`${H}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: H }, body: JSON.stringify({ email: 'y.elamrani@atlas.ma', password: 'Admin123!' }) });
const cookie = r0.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
const call = async (m, p, b) => { const r = await fetch(H + p, { method: m, headers: { Cookie: cookie, 'Content-Type': 'application/json', Origin: H }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const res = [];
const log = (name, o) => { res.push({ name, ...o }); console.log(name, JSON.stringify(o)); };

// T1 organisation city (school_settings + dual-write to setting_values organization.city)
{
  const g = await call('GET', '/api/settings');
  const KEYS = process.env.ORG_KEYS.split(',').filter(Boolean);
  const orig = Object.fromEntries(KEYS.filter(k => g.j?.data?.[k] !== undefined && g.j?.data?.[k] !== null).map(k => [k, g.j.data[k]]));
  const w = await call('POST', '/api/settings', { ...orig, city: 'Rabat-PROBE' });
  await new Promise(r => setTimeout(r, 800));
  const back = (await call('GET', '/api/settings')).j?.data?.city;
  const dbLegacy = sql(`select city from school_settings where tenant_id::text='${ids.atlas_tid}'`);
  const dbValues = sql(`select value::text from setting_values where tenant_id::text='${ids.atlas_tid}' and key='organization.city' and branch_id is null`);
  const rest = await call('POST', '/api/settings', orig);
  log('T1 organisation.city', { save: w.s, err: w.j?.error?.code, reloaded: back, school_settings: dbLegacy, setting_values: dbValues, restore: rest.s, after: sql(`select city from school_settings where tenant_id::text='${ids.atlas_tid}'`) });
}
// T3 session year end date
{
  const list = (await call('GET', '/api/academics/session-years')).j?.data ?? [];
  const y = list.find(x => x.id === ids.sy);
  const w = await call('PUT', '/api/academics/session-years', { id: ids.sy, endDate: '2027-07-15' });
  const db = sql(`select end_date from session_years where id='${ids.sy}'`);
  const rest = await call('PUT', '/api/academics/session-years', { id: ids.sy, endDate: y?.endDate });
  log('T3 session_years.endDate', { orig: y?.endDate, save: w.s, err: w.j?.error?.code ?? w.j?.error?.message, db, restore: rest.s, after: sql(`select end_date from session_years where id='${ids.sy}'`) });
}
// T4 semester name
{
  const list = (await call('GET', '/api/academics/semesters')).j?.data ?? [];
  const s = list.find(x => x.id === ids.sem);
  const w = await call('PUT', '/api/academics/semesters', { id: ids.sem, name: `${s?.name} PROBE` });
  const db = sql(`select name from semesters where id='${ids.sem}'`);
  const rest = await call('PUT', '/api/academics/semesters', { id: ids.sem, name: s?.name });
  log('T4 semesters.name', { orig: s?.name, save: w.s, err: w.j?.error?.code, db, restore: rest.s, after: sql(`select name from semesters where id='${ids.sem}'`) });
}
// T5 numbering series name (versioned)
{
  const g = (await call('GET', `/api/settings/numbering/${ids.ns}`)).j?.data;
  const orig = g?.series ?? g;
  const w = await call('PATCH', `/api/settings/numbering/${ids.ns}`, { name: `${orig?.name} PROBE` });
  const db = sql(`select name from numbering_series_definitions where id='${ids.ns}'`);
  const rest = await call('PATCH', `/api/settings/numbering/${ids.ns}`, { name: orig?.name });
  log('T5 numbering.name', { orig: orig?.name, save: w.s, err: w.j?.error?.code ?? w.j?.error?.message, db, restore: rest.s, after: sql(`select name from numbering_series_definitions where id='${ids.ns}'`), versions: sql(`select count(*) from numbering_series_versions where series_id='${ids.ns}'`) });
}
// T6 custom field label (versioned)
{
  const g = (await call('GET', `/api/settings/custom-fields/${ids.cf}`)).j?.data;
  const orig = g?.definition ?? g;
  const w = await call('PATCH', `/api/settings/custom-fields/${ids.cf}`, { label: `${orig?.label} PROBE` });
  const db = sql(`select label from custom_field_definitions where id='${ids.cf}'`);
  const rest = await call('PATCH', `/api/settings/custom-fields/${ids.cf}`, { label: orig?.label });
  log('T6 custom_field.label', { orig: orig?.label, save: w.s, err: w.j?.error?.code ?? w.j?.error?.message, db, restore: rest.s, after: sql(`select label from custom_field_definitions where id='${ids.cf}'`) });
}
// Audit trail written in the last 10 minutes
log('AUDIT rows (last 10 min, atlas)', { rows: sql(`select entity_type||':'||action||':'||left(coalesce(metadata::text,'{}'),90) from audit_logs where tenant_id::text='${ids.atlas_tid}' and created_at > now() - interval '10 minutes' order by created_at`).split('\n') });
log('SETTING history tables', { tables: sql(`select string_agg(table_name, ',') from information_schema.tables where table_name ilike '%setting%' or table_name ilike '%version%'`) });
