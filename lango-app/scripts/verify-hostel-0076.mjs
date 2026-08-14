// Verify + (re)apply migration 0076_hostel_management.sql against the live DB.
// Runs the file block-by-block (split on --> statement-breakpoint), twice, to
// prove idempotency, then prints the resulting table/constraint inventory.
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const HOSTEL_TABLES = [
  'hostel_policies', 'hostels', 'hostel_zones', 'hostel_room_categories',
  'hostel_rooms', 'hostel_beds', 'hostel_applications', 'hostel_allocations',
  'hostel_allocation_events', 'hostel_roll_calls', 'hostel_roll_call_entries',
  'hostel_leave_passes', 'hostel_leave_pass_approvals', 'hostel_leave_pass_returns',
  'hostel_escalations', 'hostel_charge_links',
];

const EXPECTED_CONSTRAINTS = [
  'hostel_policies_tenant_unique',
  'hostels_tenant_code_unique',
  'hostel_zones_tenant_hostel_code_unique',
  'hostel_room_categories_tenant_code_unique',
  'hostel_rooms_tenant_hostel_code_unique',
  'hostel_beds_tenant_room_code_unique',
  'hostel_allocations_bed_no_overlap',
  'hostel_allocations_student_no_overlap',
  'hostel_roll_calls_tenant_hostel_date_unique',
  'hostel_roll_call_entries_tenant_rollcall_allocation_unique',
  'hostel_leave_pass_returns_tenant_leave_pass_unique',
  'hostel_escalations_tenant_idempotency_key_unique',
];

async function runBlock(block) {
  await pool.query(block);
}

async function applyFile(label) {
  const file = path.join(process.cwd(), 'migrations', '0076_hostel_management.sql');
  const query = fs.readFileSync(file, 'utf-8');
  const blocks = query.split('--> statement-breakpoint').map((s) => s.trim()).filter((s) => s.length > 0);
  console.log(`[${label}] running ${blocks.length} blocks...`);
  for (const block of blocks) {
    await runBlock(block);
  }
  console.log(`[${label}] OK`);
}

async function inventory() {
  const tables = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY($1) ORDER BY tablename",
    [HOSTEL_TABLES],
  );
  const present = new Set(tables.rows.map((r) => r.tablename));
  const missing = HOSTEL_TABLES.filter((t) => !present.has(t));
  console.log(`tables: ${present.size}/16 present` + (missing.length ? ` MISSING: ${missing.join(', ')}` : ''));

  const exts = await pool.query("SELECT extname FROM pg_extension WHERE extname='btree_gist'");
  console.log(`btree_gist extension: ${exts.rowCount} row(s)`);

  const cons = await pool.query(
    "SELECT conname, contype FROM pg_constraint WHERE conname = ANY($1) ORDER BY conname",
    [EXPECTED_CONSTRAINTS],
  );
  const haveCons = new Set(cons.rows.map((r) => r.conname));
  const missingCons = EXPECTED_CONSTRAINTS.filter((c) => !haveCons.has(c));
  console.log(`constraints: ${haveCons.size}/12 present` + (missingCons.length ? ` MISSING: ${missingCons.join(', ')}` : ''));

  const enums = await pool.query(
    "SELECT typname FROM pg_type WHERE typname IN ('hostel_allocation_state','hostel_roll_call_entry_status') ORDER BY typname",
  );
  console.log(`enums: ${enums.rows.map((r) => r.typname).join(', ') || 'NONE'}`);
}

async function main() {
  console.log('--- PRE state ---');
  await inventory().catch((e) => console.log('PRE inventory skipped:', e.message));

  console.log('\n--- PASS 1 (apply) ---');
  await applyFile('pass1');
  await inventory();

  console.log('\n--- PASS 2 (re-run, idempotency) ---');
  await applyFile('pass2');
  await inventory();

  console.log('\nVERDICT:', HOSTEL_TABLES.length === 16 && EXPECTED_CONSTRAINTS.length === 12 ? 'check counts above' : 'incomplete');
  await pool.end();
}

main().then(() => process.exit(0)).catch(async (e) => {
  console.error('FATAL', e);
  await pool.end();
  process.exit(1);
});
