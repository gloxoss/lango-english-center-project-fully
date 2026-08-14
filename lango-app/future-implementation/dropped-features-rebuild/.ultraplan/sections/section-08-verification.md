# Section 08: Final verification

## Overview
Closes out the plan the same way every prior phase of this session has: independent, live re-verification against the real Docker container and database — never trusting a self-reported "done." Confirms all 6 feature areas work end to end and, critically, that nothing already-real broke as a side effect (guardian editing, class CRUD, the schedule builder, exam creation, admission approval, the transfer action).

## Risk: green - verification only, no new production logic
The only risk is verification being rushed or shallow. Mitigated by requiring one real request per new/changed route, not a sample.

## Dependencies
- **Depends on:** section-01, section-02, section-03, section-04, section-05, section-06, section-07 (all prior sections)
- **Blocks:** none
- **Parallel batch:** 3

## TDD Test Stubs
- Test: Every route added or changed in sections 02-07 responds correctly to a real authenticated request against a real tenant.
- Test: Every route added or changed rejects a cross-tenant reference (another tenant's guardian/class/room/exam/applicant/branch ID) with a 4xx, never a silent success.
- Test: Every pre-existing real feature this plan builds alongside (guardian edit, class CRUD, schedule builder, exam question CRUD, admission approval, transfer action) still works exactly as before.

## Tasks

<task type="auto" id="08-01">
  <name>Typecheck and full Docker rebuild</name>
  <files>none</files>
  <action>
    Run `npx tsc --noEmit` across the whole project — 0 errors required. Run `docker compose build app` and `docker compose build migrate` in the foreground. Confirm migration 0058 is applied (already done in task 01-03/01-04, re-verify here after all section code lands on top of it).
  </action>
  <verify>tsc clean, both Docker builds succeed, app container starts and responds.</verify>
  <done>The full codebase, including all 6 feature areas, typechecks and builds cleanly in Docker.</done>
</task>

<task type="auto" id="08-02">
  <name>Live curl verification of every new/changed route</name>
  <files>none</files>
  <action>
    Against the running container and a real authenticated tenant session, exercise: guardian link PATCH (02-01), guardian detail GET/PATCH (02-02), household payments GET (02-03), household activity GET (02-04); class cycle POST (03-01), class-section maxStudents/homeRoomId POST (03-02), homeroom-teacher PUT/DELETE (03-03); schedule roomLabel filter GET (04-01); exam question tagging POST (05-01), question bank POST/GET (05-02), copy-into-exam POST (05-03); admission interview PUT/GET (06-01), comments POST/GET (06-02), checklist PATCH (06-03); transfer-stats GET (07-01). For each, confirm a real DB row results (via psql where relevant) and tenant isolation holds (a second tenant's ID is rejected).
  </action>
  <verify>Every route above returns the expected real data and every cross-tenant probe is rejected. Document any failure found and fix before proceeding.</verify>
  <done>Every route built in this plan is confirmed live-working against a real database, with tenant isolation verified, not assumed.</done>
</task>

<task type="checkpoint" id="08-03">
  <name>Confirm no regressions in prior real features</name>
  <files>none</files>
  <action>
    Re-run a smoke check on each pre-existing real feature this plan builds alongside: edit a guardian's core fields (name/phone), create/edit a class and section via the normal form, add/edit a real schedule slot in class view, create a real exam question the old way (no bank fields), approve a real admission applicant end to end, perform a real branch transfer. Present the results to the user for confirmation before considering this plan complete.
  </action>
  <verify>User confirms every pre-existing feature still behaves exactly as it did before this plan started.</verify>
  <done>No regressions found in any feature this plan built alongside; user has confirmed the full rebuild is complete.</done>
</task>
