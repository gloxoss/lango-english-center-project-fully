// Apply + idempotency-verify migration 0113_events_addon_completion.sql
// (event_reminder_rules, event_communication_jobs, event_attachments,
//  event_tasks, event_incidents, event_feedback, event_audit_events
//  + event_occurrences_schedule_date_uidx) for plan #26 Events completion.
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim();
  }
}

loadLocalEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos' });

const file = path.join(process.cwd(), 'migrations', '0113_events_addon_completion.sql');
const sql = fs.readFileSync(file, 'utf-8');
const statements = sql.split(/--> statement-breakpoint/).map(s => s.trim()).filter(Boolean);

async function apply(label) {
  for (const stmt of statements) await pool.query(stmt);
  console.log(`[${label}] applied ${statements.length} statement(s)`);
}

async function table(name) {
  const r = await pool.query(`select to_regclass($1) as t`, [name]);
  if (!r.rows[0]?.t) throw new Error(`${name} missing`);
}

async function check() {
  for (const t of ['event_reminder_rules', 'event_communication_jobs', 'event_attachments', 'event_tasks', 'event_incidents', 'event_feedback', 'event_audit_events']) {
    await table(t);
  }
  const uidx = await pool.query(`select 1 from pg_indexes where indexname = 'event_occurrences_schedule_date_uidx'`);
  if (!uidx.rowCount) throw new Error('event_occurrences_schedule_date_uidx missing');
  const fkCount = await pool.query(`select count(*)::int as n from pg_constraint
    where conname in ('event_reminder_rules_event_id_events_id_fk','event_communication_jobs_event_id_events_id_fk',
      'event_attachments_event_id_events_id_fk','event_tasks_event_id_events_id_fk',
      'event_incidents_event_id_events_id_fk','event_feedback_event_id_events_id_fk',
      'event_audit_events_event_id_events_id_fk')`);
  if (fkCount.rows[0].n < 7) throw new Error(`only ${fkCount.rows[0].n}/7 event FKs present`);
  console.log('[check] 7 event tables + schedule_date uidx + 7 event FKs ok');
}

await apply('pass1');
await check();
await apply('pass2');
await check();
await pool.end();
console.log('0113 idempotent re-run OK');
