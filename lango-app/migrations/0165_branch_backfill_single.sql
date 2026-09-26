-- 0165_branch_backfill_single.sql — SINGLE-BRANCH SCHOOLS GET A CAMPUS.
--
-- BRANCH-SCOPE-01 B2-01. A school with exactly one ACTIVE branch has no
-- campus ambiguity: every row belongs to that campus. But 41 tables carry a
-- branch_id that was optional until now, so most rows at single-branch
-- schools (and every row the school ever seeded) have branch_id NULL. Once
-- the branch scope is enforced everywhere (waves W1-W6), NULL means "non
-- affecté" and is hidden from branch-locked staff — at a single-branch
-- school that would hide the school's own data from its own staff.
--
-- So: for every tenant with EXACTLY ONE active branch, set branch_id to that
-- branch wherever it is NULL. Tenants with 0 or 2+ active branches are NOT
-- touched — at a multi-branch school a NULL is a real "not yet assigned"
-- that the school must resolve (DB2; scripts/check-branch-data.ts reports
-- it), and guessing a campus is never the code's decision.
--
-- user rows: only staff and student roles are stamped. super_admin is
-- platform-level and stays untouched; parents/alumni are never
-- branch-filtered, so a stamp on them would be dead data.
--
-- Hand-written, forward-only, IDEMPOTENT (only rows with branch_id IS NULL
-- are written; re-running matches nothing). Plain UPDATEs: no trigger is
-- bypassed — if a guarded table refuses, this migration fails and the
-- deploy stops (post-merge gate: a failed migration must not report
-- success).

DO $$
DECLARE
  t text;
  -- Legacy type drift, verified against information_schema (2026-09-25):
  --   - events / exam_halls type tenant_id as TEXT (branch_id is uuid)
  --   - the four transport tables type tenant_id AND branch_id as TEXT
  -- Keep the three lists in step with scripts/check-branch-data.ts.
  branch_tables text[] := array[
    'applicants',
    'classes',
    'communication_automations',
    'communication_campaigns',
    'communication_connections',
    'communication_segments',
    'departments',
    'employee_profiles',
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
    'setting_values'
  ];
  -- text tenant_id, uuid branch_id
  branch_tables_text_tenant text[] := array['events', 'exam_halls'];
  -- text tenant_id, text branch_id
  branch_tables_text_both text[] := array[
    'transport_routes',
    'transport_stops',
    'transport_trips',
    'transport_vehicles'
  ];
BEGIN
  FOREACH t IN ARRAY branch_tables LOOP
    EXECUTE format(
      'update %I set branch_id = ('
      || 'select b.id from branches b '
      || 'where b.tenant_id = %I.tenant_id and b.is_active'
      || ') '
      || 'where branch_id is null '
      || 'and (select count(*) from branches b2 '
      || '     where b2.tenant_id = %I.tenant_id and b2.is_active) = 1',
      t, t, t
    );
  END LOOP;

  FOREACH t IN ARRAY branch_tables_text_tenant LOOP
    EXECUTE format(
      'update %I set branch_id = ('
      || 'select b.id from branches b '
      || 'where b.tenant_id = %I.tenant_id::uuid and b.is_active'
      || ') '
      || 'where branch_id is null '
      || 'and (select count(*) from branches b2 '
      || '     where b2.tenant_id = %I.tenant_id::uuid and b2.is_active) = 1',
      t, t, t
    );
  END LOOP;

  FOREACH t IN ARRAY branch_tables_text_both LOOP
    EXECUTE format(
      'update %I set branch_id = ('
      || 'select b.id::text from branches b '
      || 'where b.tenant_id = %I.tenant_id::uuid and b.is_active'
      || ') '
      || 'where branch_id is null '
      || 'and (select count(*) from branches b2 '
      || '     where b2.tenant_id = %I.tenant_id::uuid and b2.is_active) = 1',
      t, t, t
    );
  END LOOP;

  -- user: staff and student roles only (see header).
  UPDATE "user"
  SET branch_id = (
    SELECT b.id FROM branches b
    WHERE b.tenant_id = "user".tenant_id AND b.is_active
  )
  WHERE branch_id IS NULL
    AND role IN ('school_admin', 'teacher', 'accountant', 'receptionist', 'guard', 'librarian', 'student')
    AND (SELECT count(*) FROM branches b2
         WHERE b2.tenant_id = "user".tenant_id AND b2.is_active) = 1;
END $$;
