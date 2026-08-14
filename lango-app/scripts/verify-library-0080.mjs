// Verify + (re)apply migration 0080_library_management.sql against the live DB.
// Runs the file block-by-block (split on --> statement-breakpoint), twice, to
// prove idempotency, then asserts every expected table / index / constraint /
// enum exists. Exits nonzero on any missing object.
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const LIBRARY_TABLES = [
  'library_bibliographic_records', 'library_contributors', 'library_record_contributors',
  'library_publishers', 'library_categories', 'library_subjects', 'library_record_subjects',
  'library_editions', 'library_copies', 'library_members', 'library_loan_policies',
  'library_loans', 'library_loan_events', 'library_holds', 'library_hold_events',
  'library_transfers', 'library_transfer_events', 'library_stocktakes',
  'library_stocktake_observations', 'library_stocktake_adjustments',
  'library_charges', 'library_charge_adjustments', 'library_notifications',
];

const EXPECTED_UNIQUE_INDEXES = [
  'library_editions_tenant_isbn13_unique',
  'library_editions_tenant_isbn10_unique',
  'library_loans_copy_active_unique',
  'library_holds_copy_member_waiting_unique',
  'library_charges_loan_reason_unique',
  'library_charges_tenant_dedupe_key_unique',
];

const EXPECTED_CONSTRAINTS = [
  'library_contributors_tenant_name_unique',
  'library_record_contributors_record_contributor_role_unique',
  'library_publishers_tenant_name_unique',
  'library_categories_tenant_parent_name_unique',
  'library_subjects_tenant_name_unique',
  'library_record_subjects_record_subject_unique',
  'library_copies_tenant_accession_unique',
  'library_copies_tenant_barcode_unique',
  'library_members_tenant_member_number_unique',
  'library_members_tenant_user_unique',
  'library_loan_policies_tenant_category_branch_unique',
  'library_loans_due_after_issue_check',
  'library_transfers_distinct_branches_check',
];

const EXPECTED_ENUMS = [
  'library_copy_state', 'library_copy_condition', 'library_member_state',
  'library_loan_event_type', 'library_hold_state', 'library_transfer_state',
  'library_stocktake_state', 'library_charge_state', 'library_charge_adjustment_type',
  'library_notification_type',
];

async function applyFile(label) {
  const file = path.join(process.cwd(), 'migrations', '0080_library_management.sql');
  const query = fs.readFileSync(file, 'utf-8');
  const blocks = query.split('--> statement-breakpoint').map((s) => s.trim()).filter((s) => s.length > 0);
  console.log(`[${label}] running ${blocks.length} blocks...`);
  for (const block of blocks) {
    await pool.query(block);
  }
  console.log(`[${label}] OK`);
}

let failed = false;
function assert(cond, msg) {
  if (!cond) { failed = true; console.log(`  FAIL: ${msg}`); }
  else console.log(`  ok: ${msg}`);
}

async function inventory(label) {
  console.log(`\n[${label}] inventory`);

  const tables = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY($1) ORDER BY tablename",
    [LIBRARY_TABLES],
  );
  const present = new Set(tables.rows.map((r) => r.tablename));
  const missing = LIBRARY_TABLES.filter((t) => !present.has(t));
  assert(missing.length === 0, `tables ${present.size}/${LIBRARY_TABLES.length} present` + (missing.length ? ` MISSING: ${missing.join(', ')}` : ''));

  const indexes = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname = ANY($1) ORDER BY indexname",
    [EXPECTED_UNIQUE_INDEXES],
  );
  const haveIdx = new Set(indexes.rows.map((r) => r.indexname));
  const missingIdx = EXPECTED_UNIQUE_INDEXES.filter((i) => !haveIdx.has(i));
  assert(missingIdx.length === 0, `unique indexes ${haveIdx.size}/${EXPECTED_UNIQUE_INDEXES.length}` + (missingIdx.length ? ` MISSING: ${missingIdx.join(', ')}` : ''));

  const cons = await pool.query(
    "SELECT conname FROM pg_constraint WHERE conname = ANY($1) ORDER BY conname",
    [EXPECTED_CONSTRAINTS],
  );
  const haveCons = new Set(cons.rows.map((r) => r.conname));
  const missingCons = EXPECTED_CONSTRAINTS.filter((c) => !haveCons.has(c));
  assert(missingCons.length === 0, `constraints ${haveCons.size}/${EXPECTED_CONSTRAINTS.length}` + (missingCons.length ? ` MISSING: ${missingCons.join(', ')}` : ''));

  const enums = await pool.query(
    "SELECT typname FROM pg_type WHERE typname = ANY($1) ORDER BY typname",
    [EXPECTED_ENUMS],
  );
  const haveEnums = new Set(enums.rows.map((r) => r.typname));
  const missingEnums = EXPECTED_ENUMS.filter((e) => !haveEnums.has(e));
  assert(missingEnums.length === 0, `enums ${haveEnums.size}/${EXPECTED_ENUMS.length}` + (missingEnums.length ? ` MISSING: ${missingEnums.join(', ')}` : ''));

  const libRole = await pool.query(
    "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'role'::regtype AND enumlabel = 'librarian'",
  );
  assert(libRole.rowCount === 1, `role enum contains 'librarian'`);

  // Prove the active-loan invariant is actually enforced by the DB.
  // pg_indexes formats the predicate with parens: "WHERE (returned_at IS NULL)".
  const activeLoans = await pool.query(
    "SELECT indexdef FROM pg_indexes WHERE indexname = 'library_loans_copy_active_unique'",
  );
  const pred = activeLoans.rows[0]?.indexdef.replace(/\s+/g, ' ') ?? '';
  assert(activeLoans.rows.length === 1 && pred.includes('WHERE (returned_at IS NULL)'),
    'library_loans_copy_active_unique is partial (WHERE returned_at IS NULL)');
}

async function main() {
  console.log('--- PASS 1 (apply) ---');
  await applyFile('pass1');
  await inventory('pass1');

  console.log('\n--- PASS 2 (re-run, idempotency) ---');
  await applyFile('pass2');
  await inventory('pass2');

  console.log(failed ? '\nVERDICT: FAILED (missing objects)' : '\nVERDICT: PASS (all objects present, idempotent)');
  await pool.end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL', e);
  await pool.end();
  process.exit(1);
});
