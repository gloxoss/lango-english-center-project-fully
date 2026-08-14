# Section 02: Households — real co-tutors, pickup, comm-prefs, payment history, activity log

## Overview
Implements the PRD's "Family view for guardians" Must Have. A household stays what the discovery decision defined it as — the guardians already linked to a given student via `guardianStudents` — so no household entity is created. This section makes that grouping real and query-driven (per-student "who else is linked to this child" instead of the current UI's fabricated last-name-based family cards), and adds the four small new real fields from section-01 to the guardian API surface: pickup authorization, emergency-contact ranking, communication preferences, plus a genuinely new cross-student payment-history aggregate and an activity log read on top of the existing `auditLogs` table.

## Risk: yellow - payment aggregation crosses multiple students per guardian
The comm-prefs/pickup/priority parts are simple column read/write. The payment-history aggregate is the one piece of real business logic: it must correctly resolve every student linked to a guardian, then correctly sum/list `invoices`/`payments` per student without leaking another guardian's or another tenant's data — worth the yellow rating specifically for that one endpoint.

## Dependencies
- **Depends on:** section-01 (schema foundation)
- **Blocks:** none
- **Parallel batch:** 2

## TDD Test Stubs
- Test: A guardian linked to student X, where student X has a second guardian Y, sees Y listed as a real co-tutor when viewing X's guardian panel — not fabricated, not requiring a new table.
- Test: Setting `canPickup=true` for guardian A on student X persists and does not affect guardian A's pickup status on student Z.
- Test: Setting `emergencyPriority=1` for guardian A and `2` for guardian B, both on student X, causes A to sort first in any emergency-contact ordering.
- Test: Toggling `emailOptIn`/`smsOptIn`/`preferredLanguage` on a guardian persists across reload.
- Test: A guardian linked to 3 students sees invoices/payments from all 3 combined, correctly attributed to the right child, in one response.
- Test: The activity log for a guardian shows a real entry after their info is edited; a different tenant's guardian activity never appears.

## Tasks

<task type="auto" id="02-01">
  <name>Add PATCH for guardian-student link fields</name>
  <files>src/app/api/students/parents/link/route.ts</files>
  <action>
    Read the existing file (POST creates/links, DELETE unlinks). Add a PATCH handler, cap `students.guardians.manage`, accepting `{guardianId, studentId, emergencyPriority?, canPickup?}` via a Zod `.strict()` schema, validating both the guardian and student belong to the tenant, then updating the matching `guardianStudents` row's `emergencyPriority`/`canPickup` columns. Call `recordAudit(context, 'update', 'guardian_student', link.id, {...})` on success.
  </action>
  <verify>PATCH with valid `guardianId`/`studentId`/`canPickup: true` returns 200 and the DB row reflects it. PATCH with a `studentId` from another tenant returns a 422 reference error, not a silent no-op.</verify>
  <done>PATCH /api/students/parents/link updates emergencyPriority/canPickup on a real guardianStudents row with tenant validation and audit logging.</done>
</task>

<task type="auto" id="02-02">
  <name>Extend guardian detail route: comm-prefs, co-guardians, PATCH fields</name>
  <files>src/app/api/students/parents/[id]/route.ts</files>
  <action>
    Read the existing file. In GET, add `emailOptIn`, `smsOptIn`, `preferredLanguage` to the top-level guardian response object, and for each entry in the existing `linkedStudents[]` array add `emergencyPriority`, `canPickup`, and a new `coGuardians: {guardianId, name, relationshipType}[]` field — computed by querying `guardianStudents` joined to `guardians` for the same `studentId`, excluding the current guardian's own row. In the existing PATCH handler, extend the Zod `.strict()` schema to accept optional `emailOptIn`/`smsOptIn`/`preferredLanguage` and include them in the `db.update(guardians).set({...})` call.
  </action>
  <verify>GET on a guardian linked to a student with a second real guardian returns that second guardian inside `coGuardians` for that student. PATCH with `emailOptIn: false` persists and is reflected on the next GET.</verify>
  <done>GET/PATCH /api/students/parents/[id] expose real comm-prefs and real per-student co-guardian lists, no fabricated data.</done>
</task>

<task type="auto" id="02-03">
  <name>Build household payment-history aggregate route</name>
  <files>src/app/api/students/parents/[id]/payments/route.ts</files>
  <action>
    New file. GET handler, cap `guardians.read`. Resolve the guardian's tenant-scoped `guardianStudents` rows to get every linked `studentId`. Query `invoices` and `payments` in two batched queries using `inArray(studentId, [...allLinkedStudentIds])` (not a per-student loop — avoids N+1), joined to `user` for each student's display name, merged into one array sorted by date descending, each entry tagged with `{studentId, studentName}`. Support an optional `?limit=` (default 100) to cap response size for a guardian with many years of invoice history. Return `{success: true, data: mergedEntries}`.
  </action>
  <verify>A guardian linked to 2 real students with invoices on both returns entries from both students in one sorted list, produced via 2 queries total (not N+1, confirm by reading the implementation). A guardian with 0 linked students returns an empty array, not an error.</verify>
  <done>GET /api/students/parents/[id]/payments returns a real, tenant-scoped, cross-student payment history for a guardian.</done>
</task>

<task type="auto" id="02-04">
  <name>Build guardian activity-log read route</name>
  <files>src/app/api/students/parents/[id]/activity/route.ts</files>
  <action>
    New file. GET handler, cap `guardians.read`. Query `auditLogs` where `tenantId` matches context AND (`entityType = 'guardian' AND entityId = id`) OR (`entityType = 'guardian_student' AND metadata` references this guardian — join against the resolved link IDs from `guardianStudents` for this guardian), ordered by `createdAt` desc, limited to 20. Return `{success: true, data: entries}` with `{action, entityType, actorId, createdAt}` per entry (matches the real, sufficient field set already established in this session's audit-log precedent — no fabricated `ip`/`oldValue`/`newValue` columns).
  </action>
  <verify>Editing a real guardian's info, then calling this route, shows a new real entry within the last 20. A different tenant's guardian audit entries never appear.</verify>
  <done>GET /api/students/parents/[id]/activity returns a real, tenant-scoped recent-activity log sourced from the existing auditLogs table.</done>
</task>

<task type="auto" id="02-05">
  <name>Wire comm-prefs, pickup, and co-tutors into the guardian inspector UI</name>
  <files>src/features/students/ui/parents-guardians-client.tsx</files>
  <action>
    Read the existing file in full. Replace the fabricated "Créer un foyer" button and any remaining fake sections with: real email/SMS opt-in toggles and a preferred-language select (wired to the PATCH from task 02-02), a real per-linked-student pickup-authorization badge/toggle and emergency-priority number input (wired to the PATCH from task 02-01), and a real "Co-tuteurs" list per linked student rendering `coGuardians` from task 02-02's GET response. Handle the zero-guardian edge case honestly: a student with no linked guardians shows "Aucun tuteur lié" with a real "Lier un tuteur" action (reuse the existing link flow), never a blank gap or a crash. Keep the existing real search/filter/list mechanics untouched.
  </action>
  <verify>In the browser, toggling a comm-pref or pickup flag for a real guardian persists after a page reload. A student with 2 real linked guardians shows the second one as a co-tutor on the first guardian's panel.</verify>
  <done>The guardian inspector panel shows and edits real comm-prefs, pickup authorization, emergency priority, and co-tutors, with no remaining fabricated household UI.</done>
</task>

<task type="auto" id="02-06">
  <name>Add payment-history and activity-log panels to guardian inspector</name>
  <files>src/features/students/ui/parents-guardians-client.tsx</files>
  <action>
    Add two new sections to the same inspector panel edited in task 02-05: a "Historique de paiement du foyer" list fetching from task 02-03's route (showing amount, student name, date, status per entry), and an "Activité récente" list fetching from task 02-04's route (showing action, actor, date). Both real empty-state handled ("Aucun paiement enregistré" / "Aucune activité récente") rather than hidden or fabricated.
  </action>
  <verify>Selecting a real guardian with real invoices shows their combined payment history correctly attributed per child. A guardian with no activity shows the honest empty state, not a blank gap or an error.</verify>
  <done>The guardian inspector panel shows real, cross-student payment history and a real recent-activity log, both with honest empty states.</done>
</task>
