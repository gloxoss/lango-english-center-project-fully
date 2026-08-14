// Safe, idempotent fixture creator for scripts/verify-guard-security.mjs (tenant A = atlas).
//
// SAFETY CONTRACT
//   * Never deletes or recreates the shared ATL (default) branch or any pre-existing row.
//   * All fixture rows are scoped to a dedicated fixture branch `VERIFY-GUARD` and stable
//     fixture identifiers (guard user USR-GUARD-001 / guard1@atlas.ma, guardian
//     guardian.fixture@atlas.ma, gate VG1 / shift VGS1 in that branch).
//   * Cleanup deletes ONLY rows that reference those fixture identifiers. It never touches
//     normal tenant users, the ATL branch, real guardians, real gates/shifts/assignments,
//     students or operational records.
//   * Each create/cleanup run is wrapped in a single transaction.
//   * Idempotent: create mode first removes prior fixture rows, then rebuilds them so a fresh
//     active pickup authorization exists after every run.
//
// Modes:
//   node scripts/create-guard-fixtures.mjs             create (idempotent)
//   node scripts/create-guard-fixtures.mjs --cleanup   remove all fixture rows + fixture branch
//
// Env overrides: VERIFY_TENANT (default atlas), DATABASE_URL.
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const TENANT = process.env.VERIFY_TENANT ?? 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const BRANCH_CODE = 'VERIFY-GUARD';
const BRANCH_NAME = 'Verification Guard Branch';
const GUARD_USER_ID = 'USR-GUARD-001';
const GUARD_EMAIL = 'guard1@atlas.ma';
const GUARDIAN_EMAIL = 'guardian.fixture@atlas.ma';
const STUDENT_ID = 'STU-001';
const ADMIN_USER_ID = 'USR-001';
const ADMIN_EMAIL = 'y.elamrani@atlas.ma';
const GATE_CODE = 'VG1';
const SHIFT_NAME = 'VGS1';

const CLEANUP = process.argv.includes('--cleanup');

// Best-effort removal of attachment blobs under UPLOADS_ROOT/<tenant>/<storage_key>.
const UPLOAD_ROOTS = [process.env.UPLOADS_DIR, '/app/uploads', 'data/uploads', '.uploads'].filter(Boolean);
async function removeBlob(storageKey) {
  if (!storageKey) return;
  for (const root of UPLOAD_ROOTS) {
    try {
      await unlink(path.join(root, TENANT, storageKey));
      return;
    } catch {
      // file already gone or wrong root — keep trying other roots, never fail cleanup
    }
  }
}

async function cleanupFixtureRows(client) {
  const guardianRow = await client.query(`select id from guardians where tenant_id=$1 and email=$2`, [TENANT, GUARDIAN_EMAIL]);
  const guardianId = guardianRow.rows[0]?.id ?? null;
  const branchRow = await client.query(`select id from branches where tenant_id=$1 and code=$2`, [TENANT, BRANCH_CODE]);
  const branchId = branchRow.rows[0]?.id ?? null;

  // Remove attachment blobs referenced by the fixture guard's incidents, then the rows.
  const atts = await client.query(`select storage_key from guard_incident_attachments where tenant_id=$1 and uploaded_by_id=$2`, [TENANT, GUARD_USER_ID]);
  for (const a of atts.rows) await removeBlob(a.storage_key);

  // 1. release events: replayed by the guard, or on a fixture authorization
  await client.query(`delete from guard_release_events where tenant_id=$1 and (operator_id=$2 or authorization_id in (
      select id from guard_pickup_authorizations where tenant_id=$1 and pickup_person_id=$3))`,
    [TENANT, GUARD_USER_ID, guardianId]);
  // 2. gate scan events: actor is the guard, or on a fixture gate
  await client.query(`delete from guard_gate_scan_events where tenant_id=$1 and (actor_id=$2 or gate_id in (
      select id from guard_gates where tenant_id=$1 and branch_id=$3))`,
    [TENANT, GUARD_USER_ID, branchId]);
  // 3. kiosk sessions: operated by the guard, or on a fixture gate
  await client.query(`delete from guard_kiosk_sessions where tenant_id=$1 and (operator_id=$2 or gate_id in (
      select id from guard_gates where tenant_id=$1 and branch_id=$3))`,
    [TENANT, GUARD_USER_ID, branchId]);
  // 4. visits: created/checked by the guard, or on a fixture gate
  await client.query(`delete from guard_visits where tenant_id=$1 and (created_by_id=$2 or gate_id in (
      select id from guard_gates where tenant_id=$1 and branch_id=$3))`,
    [TENANT, GUARD_USER_ID, branchId]);
  // 5. visitor invitations: created or hosted by the guard
  await client.query(`delete from guard_visitor_invitations where tenant_id=$1 and (created_by_id=$2 or host_id=$2)`, [TENANT, GUARD_USER_ID]);
  // 6-8. incident attachments, actions, incidents created by the guard
  await client.query(`delete from guard_incident_attachments where tenant_id=$1 and uploaded_by_id=$2`, [TENANT, GUARD_USER_ID]);
  await client.query(`delete from guard_incident_actions where tenant_id=$1 and actor_id=$2`, [TENANT, GUARD_USER_ID]);
  await client.query(`delete from guard_incidents where tenant_id=$1 and (reported_by_id=$2 or escalated_to_id=$2)`, [TENANT, GUARD_USER_ID]);
  // 9. emergency acknowledgements acknowledged by the guard, then harness activations
  await client.query(`delete from guard_emergency_acknowledgements where tenant_id=$1 and acknowledged_by_id=$2`, [TENANT, GUARD_USER_ID]);
  await client.query(`delete from guard_emergency_activations where tenant_id=$1 and (activated_by_id=$2 or reason in ('verify','verify done'))`, [TENANT, GUARD_USER_ID]);
  // 10. pickup authorizations on STU-001 for the fixture guardian (never another guardian's rows)
  if (guardianId) {
    await client.query(`delete from guard_pickup_authorizations where tenant_id=$1 and student_id=$2 and pickup_person_id=$3`, [TENANT, STUDENT_ID, guardianId]);
  }
  // 11. assignments for the guard user
  await client.query(`delete from guard_assignments where tenant_id=$1 and guard_user_id=$2`, [TENANT, GUARD_USER_ID]);
  // 12. fixture gates + shifts (scoped to the fixture branch only)
  if (branchId) {
    await client.query(`delete from guard_gates where tenant_id=$1 and branch_id=$2`, [TENANT, branchId]);
    await client.query(`delete from guard_shifts where tenant_id=$1 and branch_id=$2`, [TENANT, branchId]);
  }
  // 13. guardian link + guardian (fixture email only)
  if (guardianId) {
    await client.query(`delete from guardian_students where tenant_id=$1 and guardian_id=$2`, [TENANT, guardianId]);
    await client.query(`delete from guardians where tenant_id=$1 and id=$2`, [TENANT, guardianId]);
  }
  // 14. guard user (scanner sessions → session → account → user)
  await client.query(`delete from scanner_sessions where tenant_id=$1 and operator_id=$2`, [TENANT, GUARD_USER_ID]);
  await client.query(`delete from session where user_id=$1`, [GUARD_USER_ID]);
  await client.query(`delete from account where user_id=$1`, [GUARD_USER_ID]);
  await client.query(`delete from "user" where id=$1 and tenant_id=$2`, [GUARD_USER_ID, TENANT]);
}

async function createFixtureRows(client, branchId) {
  // Guard user (stable id; upsert keeps reruns idempotent)
  await client.query(
    `insert into "user" (id, tenant_id, email, name, email_verified, role, user_status, branch_id, must_change_password, failed_login_count)
     values ($1,$2,$3,'Gardien Fixture',true,'guard','active',$4,false,0)
     on conflict (id) do update set tenant_id=excluded.tenant_id, email=excluded.email, name=excluded.name,
       role=excluded.role, user_status=excluded.user_status, branch_id=excluded.branch_id,
       must_change_password=excluded.must_change_password, failed_login_count=0`,
    [GUARD_USER_ID, TENANT, GUARD_EMAIL, branchId],
  );

  // Credential account cloning USR-001's known hash (password = Admin123!)
  const [cred] = (await client.query(
    `select password from account where user_id=$1 and provider_id='credential'`, [ADMIN_USER_ID],
  )).rows;
  await client.query(
    `insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at)
     values ('seed-credential-guard-001',$1,'credential',$1,$2,now(),now())
     on conflict (id) do update set password=excluded.password, updated_at=now()`,
    [GUARD_USER_ID, cred.password],
  );

  // Fixture gate + shift + active assignment (all scoped to the fixture branch)
  const [gate] = (await client.query(
    `insert into guard_gates (tenant_id, branch_id, gate_code, gate_name, direction, is_active)
     values ($1,$2,$3,'Portail Fixture','both',true) returning id`,
    [TENANT, branchId, GATE_CODE],
  )).rows;
  const [shift] = (await client.query(
    `insert into guard_shifts (tenant_id, branch_id, name, start_time, end_time, is_active)
     values ($1,$2,$3,'08:00','18:00',true) returning id`,
    [TENANT, branchId, SHIFT_NAME],
  )).rows;
  await client.query(
    `insert into guard_assignments (tenant_id, branch_id, guard_user_id, gate_id, shift_id, device_id, effective_from, effective_until, status)
     values ($1,$2,$3,$4,$5,null, now() - interval '2 days', now() + interval '2 days', 'active')`,
    [TENANT, branchId, GUARD_USER_ID, gate.id, shift.id],
  );

  // Fixture guardian + STU-001 link (can_pickup) + active wide-window authorization
  const [guardian] = (await client.query(
    `insert into guardians (tenant_id, user_id, first_name, last_name, email, phone, default_relation)
     values ($1,null,'Fatima','Bennani',$2,'+212600000001','parent') returning id`,
    [TENANT, GUARDIAN_EMAIL],
  )).rows;
  await client.query(
    `insert into guardian_students (tenant_id, guardian_id, student_id, relationship_type, is_primary_contact, is_emergency_contact, can_pickup)
     values ($1,$2,$3,'parent',true,true,true)`,
    [TENANT, guardian.id, STUDENT_ID],
  );
  const [auth] = (await client.query(
    `insert into guard_pickup_authorizations (tenant_id, student_id, pickup_person_id, relationship_type, authorized_from, authorized_until, reason, status, created_by_id)
     values ($1,$2,$3,'parent', now() - interval '2 days', now() + interval '2 days', 'verify harness', 'active', $4) returning id`,
    [TENANT, STUDENT_ID, guardian.id, ADMIN_USER_ID],
  )).rows;

  return { branchId, gateId: gate.id, shiftId: shift.id, authId: auth.id, guardianId: guardian.id };
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('begin');

    // Fixture branch: created once, reused on every run, never deleted in create mode.
    let branchId = (await client.query(`select id from branches where tenant_id=$1 and code=$2`, [TENANT, BRANCH_CODE])).rows[0]?.id ?? null;
    if (!branchId) {
      const [b] = (await client.query(
        `insert into branches (tenant_id, name, code, city, is_default, is_active)
         values ($1,$2,$3,'Fixture',false,true)
         on conflict (tenant_id, code) do nothing returning id`,
        [TENANT, BRANCH_NAME, BRANCH_CODE],
      )).rows;
      branchId = b?.id ?? (await client.query(`select id from branches where tenant_id=$1 and code=$2`, [TENANT, BRANCH_CODE])).rows[0].id;
    }

    await cleanupFixtureRows(client);

    if (CLEANUP) {
      // Branch is exclusively fixture-owned; assert nothing else references it before deleting.
      const refs = await client.query(`select (
        (select count(*) from guard_gates where tenant_id=$1 and branch_id=$2) +
        (select count(*) from guard_shifts where tenant_id=$1 and branch_id=$2) +
        (select count(*) from "user" where tenant_id=$1 and branch_id=$2) +
        (select count(*) from departments where tenant_id=$1 and branch_id=$2) +
        (select count(*) from employee_profiles where tenant_id=$1 and branch_id=$2) +
        (select count(*) from inventory_stores where tenant_id=$1 and branch_id=$2) +
        (select count(*) from hostels where tenant_id=$1 and branch_id=$2)
      )::int as n`, [TENANT, branchId]);
      if (refs.rows[0].n !== 0) {
        throw new Error(`refusing to delete fixture branch: ${refs.rows[0].n} residual reference(s)`);
      }
      await client.query(`delete from branches where id=$1 and tenant_id=$2 and code=$3`, [branchId, TENANT, BRANCH_CODE]);
      await client.query('commit');
      console.log('FIXTURES REMOVED');
      console.log(`BRANCH_CODE=${BRANCH_CODE} (deleted)`);
      return;
    }

    const ids = await createFixtureRows(client, branchId);
    await client.query('commit');

    console.log('FIXTURES CREATED');
    console.log(`BRANCH_ID=${ids.branchId} (code ${BRANCH_CODE})`);
    console.log(`GATE_ID=${ids.gateId}`);
    console.log(`SHIFT_ID=${ids.shiftId}`);
    console.log(`AUTH_ID=${ids.authId}`);
    console.log(`GUARDIAN_ID=${ids.guardianId}`);
    console.log(`STUDENT_ID=${STUDENT_ID}`);
    console.log(`GUARD_USER_ID=${GUARD_USER_ID}`);
    console.log(`GUARD_EMAIL=${GUARD_EMAIL}`);
    console.log(`GUARD_PASS=Admin123!`);
    console.log(`ADMIN_EMAIL=${ADMIN_EMAIL}`);
    console.log(`ADMIN_PASS=Admin123!`);
  } catch (e) {
    await client.query('rollback').catch(() => {});
    console.error('FIXTURE FAIL', e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
