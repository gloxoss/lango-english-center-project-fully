import dotenv from 'dotenv';
import { Pool } from 'pg';

// BRANCH-SCOPE-01 B2-02 — read-only report of what a multi-branch school
// still needs to assign before branch scoping is enforced on it (plan DB2).
//
// At a multi-branch school a NULL branch_id means "non affecté": those rows
// are hidden from branch-locked staff once W1-W6 add branchWhere everywhere.
// The owner runs this against the VPS database BEFORE deploying so the
// school can assign the rows first:
//
//   DATABASE_URL=postgresql://... npx tsx scripts/check-branch-data.ts
//
// Exit code is ALWAYS 0 — this is a report, not a gate (the branch ratchet
// is scripts/check-branch-scope.ts; the parity gate is B6-01).

dotenv.config();

// Every table carrying a branch_id (mirrors migration
// 0165_branch_backfill_single.sql; keep the two lists in step).
const BRANCH_TABLES = [
  'applicants',
  'classes',
  'communication_automations',
  'communication_campaigns',
  'communication_connections',
  'communication_segments',
  'departments',
  'employee_profiles',
  'events',
  'exam_halls',
  'fee_allocation_runs',
  'fee_structures',
  'files',
  'guard_assignments',
  'guard_emergency_contacts',
  'guard_emergency_procedures',
  'guard_gates',
  'guard_incidents',
  'guard_kiosk_sessions',
  'guard_shifts',
  'guard_visitor_invitations',
  'guard_visits',
  'hostels',
  'inventory_stores',
  'leadership_scope_assignments',
  'library_closure_calendar',
  'library_copies',
  'library_loan_policies',
  'library_members',
  'library_stocktakes',
  'reception_appointments',
  'reception_handoffs',
  'report_runs',
  'report_schedules',
  'scanner_devices',
  'setting_drafts',
  'setting_values',
  'transport_routes',
  'transport_stops',
  'transport_trips',
  'transport_vehicles',
] as const;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');

    const tenants = (
      await client.query(`
        select t.id, t.name, count(b.id)::int as active_branches
        from tenants t
        left join branches b on b.tenant_id = t.id and b.is_active
        group by t.id, t.name
        order by t.name
      `)
    ).rows;
    const multi = tenants.filter(t => t.active_branches >= 2);

    if (multi.length === 0) {
      console.log('No tenant has 2+ active branches — nothing to report.');
      await client.query('COMMIT');
      return;
    }

    for (const tenant of multi) {
      console.log(`\n=== ${tenant.name} (${tenant.active_branches} branches actives) — ${tenant.id} ===`);
      console.log('Table'.padEnd(32), 'NULL branch_id');
      console.log('-'.repeat(44));

      let anyNull = false;
      for (const table of BRANCH_TABLES) {
        const res = await client.query(
          `select count(*)::int as n from ${table} where tenant_id = $1 and branch_id is null`,
          [tenant.id],
        );
        const n = res.rows[0]?.n ?? 0;
        if (n > 0) {
          anyNull = true;
          console.log(table.padEnd(32), String(n));
        }
      }
      const userRes = await client.query(
        `select role, count(*)::int as n
         from "user"
         where tenant_id = $1 and branch_id is null
         group by role order by role`,
        [tenant.id],
      );
      for (const row of userRes.rows) {
        anyNull = true;
        console.log(`user (role=${row.role})`.padEnd(32), String(row.n));
      }
      if (!anyNull) {
        console.log('(aucune ligne sans campus)');
      }

      // A student's billing/attendance follows user.branch_id (student mode),
      // so a student sitting in a class of another campus reports under their
      // assigned campus, not their class's. Report the mismatches so the
      // school can decide which side is wrong.
      const mismatch = await client.query(
        `select count(*)::int as n
         from "user" u
         join class_sections cs on cs.id = u.class_section_id
         join classes c on c.id = cs.class_id
         where u.tenant_id = $1
           and u.role = 'student'
           and u.branch_id is not null
           and c.branch_id is not null
           and u.branch_id <> c.branch_id`,
        [tenant.id],
      );
      console.log('students whose branch <> class branch:', String(mismatch.rows[0]?.n ?? 0));
    }

    await client.query('COMMIT');
    console.log('\n(read-only report; exit 0 always — DB2 decision belongs to the owner)');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
