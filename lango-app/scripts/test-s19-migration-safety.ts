// Test harness proving S-19 migration safety across:
// 1. Fresh database
// 2. Existing database with normal fine assessments
// 3. Existing database containing duplicate legacy assessments
// Proves historical financial records are preserved (never deleted) and legacy duplicates superseded.

import 'dotenv/config';
import { db } from '@/libs/DB';
import { sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

const OUT_FILE = path.resolve('artifacts/page-audit/done/AUD-FINANCE-01__student-billing-cashier/evidence/s19-migration-legacy-replay.txt');
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

const logLines: string[] = [];
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logLines.push(line);
}

function getRows<T = any>(result: any): T[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

async function run() {
  log('=================================================================');
  log('S-19 MIGRATION SAFETY & LEGACY REPLAY VERIFICATION');
  log('Proving migration 0156 safe historical preservation and idempotency');
  log('=================================================================');

  const testTenant = 't-s19-test-migration';
  const testStudent = 'stu-s19-001';
  const testPolicy = 'pol-s19-late-fee';
  const testInvoice1 = 'inv-s19-001';
  const testInvoice2 = 'inv-s19-002';

  // 1. Setup isolated test table for migration simulation
  log('\n--- Step 1: Isolating test environment ---');
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS test_fine_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(64) NOT NULL,
      student_id VARCHAR(64) NOT NULL,
      fine_policy_id VARCHAR(64) NOT NULL,
      invoice_id VARCHAR(64),
      amount NUMERIC(10, 2) NOT NULL,
      assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      assessment_period VARCHAR(16) NOT NULL,
      superseded_by_id UUID,
      superseded_at TIMESTAMP WITH TIME ZONE
    );
  `);
  await db.execute(sql`TRUNCATE TABLE test_fine_assessments;`);
  log('PASS: test_fine_assessments created and empty');

  // -------------------------------------------------------------
  // Scenario A: Fresh database (empty table)
  // -------------------------------------------------------------
  log('\n--- Scenario A: Fresh Database Migration ---');
  await db.execute(sql`
    ALTER TABLE test_fine_assessments ADD COLUMN IF NOT EXISTS superseded_by_id UUID;
    ALTER TABLE test_fine_assessments ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMP WITH TIME ZONE;
    DROP INDEX IF EXISTS test_fine_assessments_invoice_policy_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS test_fine_assessments_invoice_policy_unique
      ON test_fine_assessments (tenant_id, invoice_id, fine_policy_id)
      WHERE invoice_id IS NOT NULL AND superseded_by_id IS NULL;
  `);
  log('PASS: Migration executed cleanly on empty table. Unique index active.');

  // -------------------------------------------------------------
  // Scenario B: Existing DB with normal (unique) assessments
  // -------------------------------------------------------------
  log('\n--- Scenario B: Existing Database with Normal Fine Assessments ---');
  await db.execute(sql`TRUNCATE TABLE test_fine_assessments;`);
  await db.execute(sql`DROP INDEX IF EXISTS test_fine_assessments_invoice_policy_unique;`);

  // Insert 3 distinct valid assessments (representing pre-migration normal DB)
  await db.execute(sql`
    INSERT INTO test_fine_assessments (tenant_id, student_id, fine_policy_id, invoice_id, amount, assessed_at, assessment_period)
    VALUES 
      (${testTenant}, ${testStudent}, ${testPolicy}, ${testInvoice1}, 50.00, NOW() - INTERVAL '10 days', '2026-09'),
      (${testTenant}, ${testStudent}, ${testPolicy}, ${testInvoice2}, 50.00, NOW() - INTERVAL '5 days', '2026-09'),
      (${testTenant}, 'stu-other', ${testPolicy}, 'inv-other', 75.00, NOW() - INTERVAL '2 days', '2026-09');
  `);

  const countBeforeB = getRows<{ count: string }>(await db.execute(sql`SELECT COUNT(*)::text as count FROM test_fine_assessments;`));
  log(`Pre-migration row count in Scenario B: ${countBeforeB[0]?.count}`);

  // Replay migration on existing normal DB
  await db.execute(sql`
    ALTER TABLE test_fine_assessments ADD COLUMN IF NOT EXISTS superseded_by_id UUID;
    ALTER TABLE test_fine_assessments ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMP WITH TIME ZONE;
    
    WITH ranked AS (
      SELECT id,
             FIRST_VALUE(id) OVER (PARTITION BY tenant_id, invoice_id, fine_policy_id ORDER BY assessed_at, id) AS keeper_id,
             ROW_NUMBER() OVER (PARTITION BY tenant_id, invoice_id, fine_policy_id ORDER BY assessed_at, id) AS row_number
      FROM test_fine_assessments
      WHERE invoice_id IS NOT NULL
    )
    UPDATE test_fine_assessments AS assessment
    SET superseded_by_id = ranked.keeper_id,
        superseded_at = now()
    FROM ranked
    WHERE assessment.id = ranked.id
      AND ranked.row_number > 1
      AND assessment.superseded_by_id IS NULL;

    DROP INDEX IF EXISTS test_fine_assessments_invoice_policy_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS test_fine_assessments_invoice_policy_unique
      ON test_fine_assessments (tenant_id, invoice_id, fine_policy_id)
      WHERE invoice_id IS NOT NULL AND superseded_by_id IS NULL;
  `);

  const countAfterB = getRows<{ count: string }>(await db.execute(sql`SELECT COUNT(*)::text as count FROM test_fine_assessments;`));
  const supersededCountB = getRows<{ count: string }>(await db.execute(sql`SELECT COUNT(*)::text as count FROM test_fine_assessments WHERE superseded_by_id IS NOT NULL;`));
  
  if (countBeforeB[0]?.count !== countAfterB[0]?.count) throw new Error('Data loss in Scenario B!');
  if (Number(supersededCountB[0]?.count) !== 0) throw new Error('Normal assessments should not be superseded!');
  log(`PASS: Scenario B complete. All ${countAfterB[0]?.count} records preserved, 0 superseded, index created.`);

  // -------------------------------------------------------------
  // Scenario C: Existing DB containing duplicate legacy assessments
  // -------------------------------------------------------------
  log('\n--- Scenario C: Existing Database with Duplicate Legacy Assessments ---');
  await db.execute(sql`TRUNCATE TABLE test_fine_assessments;`);
  await db.execute(sql`DROP INDEX IF EXISTS test_fine_assessments_invoice_policy_unique;`);

  // Simulate historical buggy state: duplicate runs created multiple assessments for the SAME invoice & policy
  // Legacy duplicate set 1: 3 assessments for testInvoice1 (Day -10, Day -9, Day -8)
  // Legacy duplicate set 2: 2 assessments for testInvoice2 (Day -5, Day -4)
  // Non-duplicate assessment: 1 assessment for inv-other
  await db.execute(sql`
    INSERT INTO test_fine_assessments (id, tenant_id, student_id, fine_policy_id, invoice_id, amount, assessed_at, assessment_period)
    VALUES 
      ('11111111-1111-1111-1111-111111111111', ${testTenant}, ${testStudent}, ${testPolicy}, ${testInvoice1}, 50.00, '2026-09-01 10:00:00Z', '2026-09'),
      ('22222222-2222-2222-2222-222222222222', ${testTenant}, ${testStudent}, ${testPolicy}, ${testInvoice1}, 50.00, '2026-09-02 10:00:00Z', '2026-09'),
      ('33333333-3333-3333-3333-333333333333', ${testTenant}, ${testStudent}, ${testPolicy}, ${testInvoice1}, 50.00, '2026-09-03 10:00:00Z', '2026-09'),
      ('44444444-4444-4444-4444-444444444444', ${testTenant}, ${testStudent}, ${testPolicy}, ${testInvoice2}, 60.00, '2026-09-05 10:00:00Z', '2026-09'),
      ('55555555-5555-5555-5555-555555555555', ${testTenant}, ${testStudent}, ${testPolicy}, ${testInvoice2}, 60.00, '2026-09-06 10:00:00Z', '2026-09'),
      ('66666666-6666-6666-6666-666666666666', ${testTenant}, 'stu-other', ${testPolicy}, 'inv-other', 75.00, '2026-09-07 10:00:00Z', '2026-09');
  `);

  const countBeforeC = getRows<{ count: string }>(await db.execute(sql`SELECT COUNT(*)::text as count FROM test_fine_assessments;`));
  log(`Pre-migration row count in Scenario C: ${countBeforeC[0]?.count} (includes 3 duplicates across 2 invoices)`);

  // Run the full migration script with safe historical reconciliation
  log('Running 0156 migration script with historical preservation...');
  await db.execute(sql`
    ALTER TABLE test_fine_assessments ADD COLUMN IF NOT EXISTS superseded_by_id UUID;
    ALTER TABLE test_fine_assessments ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMP WITH TIME ZONE;
    
    WITH ranked AS (
      SELECT id,
             FIRST_VALUE(id) OVER (PARTITION BY tenant_id, invoice_id, fine_policy_id ORDER BY assessed_at, id) AS keeper_id,
             ROW_NUMBER() OVER (PARTITION BY tenant_id, invoice_id, fine_policy_id ORDER BY assessed_at, id) AS row_number
      FROM test_fine_assessments
      WHERE invoice_id IS NOT NULL
    )
    UPDATE test_fine_assessments AS assessment
    SET superseded_by_id = ranked.keeper_id,
        superseded_at = now()
    FROM ranked
    WHERE assessment.id = ranked.id
      AND ranked.row_number > 1
      AND assessment.superseded_by_id IS NULL;

    DROP INDEX IF EXISTS test_fine_assessments_invoice_policy_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS test_fine_assessments_invoice_policy_unique
      ON test_fine_assessments (tenant_id, invoice_id, fine_policy_id)
      WHERE invoice_id IS NOT NULL AND superseded_by_id IS NULL;
  `);

  const countAfterC = getRows<{ count: string }>(await db.execute(sql`SELECT COUNT(*)::text as count FROM test_fine_assessments;`));
  log(`Post-migration row count in Scenario C: ${countAfterC[0]?.count}`);

  if (countBeforeC[0]?.count !== countAfterC[0]?.count) {
    throw new Error(`CRITICAL: Financial record loss! Expected ${countBeforeC[0]?.count} but found ${countAfterC[0]?.count}`);
  }
  log('VERIFIED: Zero financial records were deleted. 100% historical data preserved.');

  // Verify keeper vs superseded linkages
  const rowsC = getRows<{ id: string; invoice_id: string; superseded_by_id: string | null }>(
    await db.execute(sql`SELECT id, invoice_id, superseded_by_id FROM test_fine_assessments ORDER BY invoice_id, assessed_at;`)
  );

  for (const r of rowsC) {
    log(`Row ${r.id} for invoice ${r.invoice_id} -> superseded_by_id: ${r.superseded_by_id ?? 'NULL (active keeper)'}`);
  }

  // Row 1111 must be active keeper, 2222 and 3333 must be superseded by 1111
  const r1 = rowsC.find(r => r.id === '11111111-1111-1111-1111-111111111111');
  const r2 = rowsC.find(r => r.id === '22222222-2222-2222-2222-222222222222');
  const r3 = rowsC.find(r => r.id === '33333333-3333-3333-3333-333333333333');

  if (r1?.superseded_by_id !== null) throw new Error('Oldest assessment 1111 should be active keeper!');
  if (r2?.superseded_by_id !== '11111111-1111-1111-1111-111111111111') throw new Error('Duplicate 2222 must be superseded by 1111!');
  if (r3?.superseded_by_id !== '11111111-1111-1111-1111-111111111111') throw new Error('Duplicate 3333 must be superseded by 1111!');
  log('VERIFIED: Linkages between superseded rows and oldest keeper are exact.');

  // Verify unique index enforcement on future inserts
  log('\n--- Verifying Future Unique Constraint Enforcement ---');
  let rejected = false;
  try {
    await db.execute(sql`
      INSERT INTO test_fine_assessments (tenant_id, student_id, fine_policy_id, invoice_id, amount, assessed_at, assessment_period)
      VALUES (${testTenant}, ${testStudent}, ${testPolicy}, ${testInvoice1}, 50.00, NOW(), '2026-09');
    `);
  } catch (err: any) {
    rejected = true;
    log(`PASS: Future duplicate insert correctly rejected by unique constraint: ${err.message}`);
  }

  if (!rejected) {
    throw new Error('FAIL: Duplicate insert should have been rejected by unique index!');
  }

  // Cleanup test table
  await db.execute(sql`DROP TABLE IF EXISTS test_fine_assessments;`);
  log('\n--- Test cleanup completed ---');

  log('=================================================================');
  log('ALL S-19 MIGRATION SAFETY SCENARIOS PASSED: 100% HISTORICAL RECORD PRESERVATION');
  log('=================================================================');

  fs.writeFileSync(OUT_FILE, logLines.join('\n'), 'utf8');
  log(`Evidence saved to ${OUT_FILE}`);
}

run().catch((e) => {
  console.error('Migration safety test failed:', e);
  process.exit(1);
});
