# UltraPlan Research: Dropped-Features Rebuild

> Generated: 2026-08-06
> Phase: 2/6 - RESEARCH
> Research topics extracted: 6 (one per feature area)
> Subagents deployed: 1 (Codebase only — no new external tech/libraries introduced, so Web/Docs research were skipped; matches this repo's own prior /ultraplan precedent of skipping subagents that add no value for a fixed-stack extension)

---

## Research Topics

| # | Topic | Source Category | Priority |
|---|-------|-----------------|----------|
| 1 | Households — guardians/guardianStudents/smsMessages/invoices/payments exact schema | Core Requirements | High |
| 2 | Classes — cycle field, capacity, homeroom-teacher, room assignment | Core Requirements | High |
| 3 | Schedule — teacher/room view filters over classScheduleSlots | Core Requirements | Medium |
| 4 | Question bank — difficulty/section/tags, reusable bank table | Core Requirements | High |
| 5 | Admission — interviews/comments tables, applicants schema | Core Requirements | High |
| 6 | Transfers — KPI aggregate sources | Core Requirements | Low (already real) |

---

## Codebase Analysis

**Type:** Existing codebase (SchoolOS — Next.js App Router, Drizzle ORM, PostgreSQL, multi-tenant)

### Findings per area (verified via direct file reads, not assumed)

**0. Cross-cutting**
- Next migration number: **0058** (last on disk is `0057_add_admission_model_enhancement.sql`). Journal references `0053_waitlist_leads` with no `.sql` file on disk — pre-existing gap, not touched by this plan, doesn't block starting at 0058.
- `requireCapability`'s second argument is a **closed TypeScript literal union** (`PermissionKey = keyof typeof PERMISSIONS`, `src/libs/api/permissions.ts:15-89`). Every new capability string this plan introduces must be added to `PERMISSIONS` and to the relevant role's array in `DEFAULT_ROLE_PERMISSIONS` (`:100-145`), or the route won't compile. Naming convention confirmed: `<domain>.<action>` (e.g. `admissions.manage`, `guardians.read`).

**1. Households** — `guardians` (`Schema.ts:1469-1496`) has no priority/pickup/comm-pref fields (all 4 genuinely new). `guardianStudents` (`:1443-1467`) is the correct table for a per-child emergency-contact rank (`emergencyPriority`) and pickup authorization (`canPickup boolean`) — ranking/authorization is per-child-per-guardian, not per-guardian. `smsMessages` (`:2021-2042`) confirmed log-only, links to student not guardian. `invoices`/`payments` (`:1523-1601`) both link to a single `studentId` — a household payment-history view requires joining `guardianStudents.guardianId → studentId → invoices/payments` for every linked student, no existing rollup. Current guardian API (`students/parents/*`) confirmed real; `parents-guardians-client.tsx` explicitly fabricates a client-side "household" grouping by last name today (no real entity) — matches the discovery decision to keep it that way (shared-student grouping, no new table), just needs the real join done server-side instead of the current name-guessing.

**2. Classes** — `classes` (`:192-229`) has no `cycle` field (confirmed genuinely missing). `classSections` (`:231-264`) has no `capacity`, no homeroom FK, no room FK. **Refinement over the discovery decision**: a homeroom-teacher concept already exists as `classTeachers` (`:338-378`) with `role='primary'` scoped to `classSectionId` — reuse this instead of adding a new `homeroomTeacherId` FK (avoids duplicating a real, already-built assignment model). One gap found: the table's partial unique index (one active primary per `(tenantId, offeringId)`) only fires when `offeringId` is set — for schools not yet using session-scoped offerings, nothing today stops two `role='primary'` rows on the same `classSectionId`. This plan adds an application-level TOCTOU check on assignment (same pattern already used in the admission-approval transaction) rather than relying solely on the DB constraint. `rooms` (`:1603-1624`) already has real `capacity`/`roomType` — a class-section's home-base room is a new FK (`classSections.homeRoomId → rooms.id`), distinct from the room's own physical capacity. The "capacity" the discovery decision meant is student-enrollment capacity (max seats for the section), a new field, not a duplicate of `rooms.capacity`.

**3. Schedule** — real live table is `classScheduleSlots` (`:2191-2236`), not the dead `timetableSlots`/`studentGroups` chain. `/api/academics/timetable-slots/route.ts` already operates on `classScheduleSlots` and already has a real teacher filter (teachers are force-scoped to their own slots; admins can pass `?teacherId=`). **Refinement**: room is a free-text `roomLabel`, not an FK (deliberate — the code comment states room management is explicitly out of scope, only label-based conflict detection matters). Room-view grouping is therefore a client-side/query grouping by `roomLabel` string, not a `rooms`-table join — matches the discovery decision (no new schema) since this needs no schema change, just a new query mode.

**4. Question bank** — confirmed exam-scoped only: `onlineExamQuestions` belongs to one `onlineExamId` (a specific scheduled exam instance with start/end times), no cross-exam bank exists. Adding `sectionLabel`/`difficulty`/subject/cycle directly to `onlineExamQuestions` is straightforward (4 new nullable columns). The **reusable bank** (discovery decision: independent-copy model) needs a genuinely new, decoupled table (`questionBankItems`: tenantId, subjectId, cycle, difficulty, questionText, marks, options as jsonb or a child table) since nothing decoupled from an exam instance exists today — confirmed not a relabeling of existing schema, a real new table as scoped.

**5. Admission** — `applicants` (`:601-668`) confirmed has no interview/comment fields — the two new tables (`admissionInterviews`, `admissionComments`) are purely additive, no overlap. `applicantDocuments` (`:2081-2101`) already has a `documentType` status-like structure (one row per type per applicant) that a "document request" indicator can read directly (missing type = not yet uploaded) — no new field needed for that part of the discovery decision. `auditLogs` (`:543-554`) confirmed nullable-tenant, no-FK-on-actor design, already used exactly this way for guardian updates today (`recordAudit(context, 'update', 'guardian', id, ...)`) — safe, proven reuse for the interaction log. No `admissions.interviews.*`/`admissions.comments.*` capability exists yet — new capability strings needed (cross-cutting note above).

**6. Transfers** — confirmed fully real and unchanged: direct POST with tenant/branch/section validation, 409 on same-branch, real `recordAudit(context, 'update', 'student_transfer', ...)` call already present. A "transfers this month" KPI is a straightforward `auditLogs` query (`entityType='student_transfer' AND createdAt >= month start`); "students per branch" is a straightforward `user.branchId` group-by against the real `branches` table. **No gap found here beyond the two KPI aggregates** — the feature itself needs no rebuild, only the two read-only KPI additions the discovery decision already scoped.

#### Reusable Components / Patterns Confirmed
- `recordAudit()` + `auditLogs` — reusable as-is for interaction logs (households, no new table).
- `classTeachers` (role=`primary`) — reusable as-is for homeroom teacher (classes, no new FK).
- `rooms` table — reusable as-is for a class-section's home-base room (new FK only, table itself untouched).
- `reserveMatricule()`-style shared-helper pattern — same extraction discipline applies to any logic touched by 2+ routes in this plan (e.g. a shared "resolve household for a student" helper used by both the guardians list and the guardian detail view).
- Existing `parseJson` + Zod `.strict()` + `apiErrorResponse()` convention — applies unchanged to all new routes.

---

## Web Research

N/A — skipped. No new external technology, library, or third-party service is introduced by this plan; it is a pure schema/route/UI extension of the existing Drizzle/PostgreSQL/Next.js stack already governing this app.

## Library Documentation

N/A — skipped, same reasoning as above.

---

## Conflicts Found

| # | User Said (Discovery) | Research Shows | Recommendation | Resolution |
|---|-----------|---------------|----------------|---------------|
| 1 | Main teacher = new assignment at class-section level | A real, already-built `classTeachers` (role=`primary`) join table already models exactly this, just missing a guaranteed one-per-section constraint when `offeringId` is unset | Reuse `classTeachers` instead of adding a new FK column; add an application-level uniqueness check | Adopted — not a scope change, same outcome (one homeroom teacher per section), cheaper build, no user decision needed |
| 2 | Room assignment on a class-section | `rooms` table exists with its own `capacity`; schedule's `roomLabel` is deliberately a free-text field, not an FK, by explicit prior design intent | Add a *new*, separate FK (`classSections.homeRoomId`) for the home-base room concept; do not touch `classScheduleSlots.roomLabel` or convert it to an FK | Adopted — no conflict with the "no new schema for schedule" decision, since schedule itself isn't touched |
| 3 | "Capacity" field on class-sections | `rooms.capacity` already exists (physical room capacity) — risk of naming confusion with a new student-enrollment capacity | Name the new field distinctly, e.g. `classSections.maxStudents`, to avoid conflating "room seats" with "enrollment cap" | Adopted — naming-only clarification, no scope change |

No conflicts required a user decision — all three are engineering refinements that reuse more of the existing real backend than the discovery-stage assumption, consistent with this session's "reuse before invent" discipline.

---

## Summary and Recommendations

### Key Architecture Decisions

1. Reuse `classTeachers`/`rooms`/`auditLogs`/`applicantDocuments` wherever the research confirmed a matching real table already exists — 4 of the 6 feature areas turn out to need less new schema than the discovery-stage read suggested.
2. Two genuinely new small tables (`admissionInterviews`, `admissionComments`) and one genuinely new decoupled table (`questionBankItems` + its options) are the only "new concept" tables in this entire plan — everything else is new columns on existing tables or new query modes over existing data.
3. All new capability strings must be registered in `PERMISSIONS`/`DEFAULT_ROLE_PERMISSIONS` before any route referencing them will compile — this is a hard TypeScript constraint, not a convention to be casually followed.

### Risks Identified in Research

1. `classTeachers`' partial unique index doesn't protect against duplicate primary teachers when `offeringId` is null (common case today, since session-scoped offerings are a separate, only-partially-shipped concept from the concurrent session's academic-management-enhancement plan) — mitigated with an application-level check, not a DB-level guarantee, so a race condition is theoretically possible under concurrent requests (acceptable risk for a low-frequency admin action, consistent with how other TOCTOU checks in this codebase are already handled).
2. The question bank's independent-copy model means a bank question edited after being copied into 10 exams does not retroactively update those 10 exams — this is the *intended* behavior per the discovery decision, but worth stating plainly so it isn't mistaken for a bug during Phase 4 review.

### Unanswered Questions

1. Exact wording of the fixed admission-checklist items (pièces reçues / entretien fait / dossier complet, etc.) — will be finalized as a literal list during Phase 3 PLAN, not a research question.

---

**User Review Status:** Approved
**User Feedback:** Confirmed all 3 refinements (reuse classTeachers, reuse rooms via new FK, rename field to maxStudents) — recommended option chosen.
**Proceed to Planning:** Yes
