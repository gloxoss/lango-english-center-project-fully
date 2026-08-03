# 02 — People and Academics Prompt Pack

Build on the existing student, guardian, employee, tenant, file, notification, and audit foundations. Do not create parallel “admission student” or “teacher assignment” truth.

## Domain contract

- Canonical chain: academic year → term → level/class → section → offering → subject/teacher/room assignment.
- A person may have multiple tenant memberships and historical assignments.
- Admissions are a workflow that may create a student only after approval; drafts are not students.
- Effective-dated history is preserved for enrollments, guardianship, assignments, transfers, and promotions.

## PA-01 — Admissions pipeline and application detail

**Routes:** `/dashboard/admissions`, `/admissions/new`, `/admissions/[id]`. **Users:** receptionist, admissions officer, school admin. **Objective:** capture an inquiry/application, collect requirements, detect duplicates, communicate, review, decide, and convert an approved applicant. **Layout:** Kanban/list toggle; detail header with stage/SLA; identity, household, documents, notes, tasks, communication, and decision timeline. **Actions:** create, assign, request document, move stage, schedule interview, approve/reject/waitlist, convert. **States:** incomplete, possible duplicate, overdue, withdrawn, rejected, approved, converted. **Acceptance:** stage transitions validated, reason required for rejection, conversion idempotently links or creates canonical records. **Exclude:** auto-admitting from a marketing form.

## PA-02 — Admission review workspace

**Route:** `/dashboard/admissions/review`. **Objective:** compare eligible applications against seats and policies without hidden scoring. **Layout:** filter rail, review queue, evidence drawer, seat-capacity summary. **Actions:** shortlist, request clarification, record explicit decision rationale, bulk-assign reviewer. **States:** conflict of interest, missing document, capacity reached. **Acceptance:** explain every rule and retain decision audit. **Exclude:** opaque AI admission decisions.

## PA-03 — Student directory and profile

**Routes:** `/dashboard/students`, `/students/[id]`. **Users:** scoped staff. **Objective:** find the right student and understand identity, enrollment, guardians, contacts, health alerts, documents, attendance, learning, and finance according to permission. **Layout:** filterable directory; profile summary plus tabs with lazy-loaded aggregates. **Actions:** edit permitted fields, link guardian, transfer/promote, upload document, reset access. **States:** active, pre-enrolled, withdrawn, graduated, archived, restricted record. **Acceptance:** sensitive panels require capabilities; historical enrollment never overwritten. **Exclude:** exposing finance/health data to every teacher.

## PA-04 — Student create/edit/import operations

**Routes:** `/dashboard/students/new`, `/students/[id]/edit`, `/students/import`. **Objective:** safely enter or bulk import students with validation and preview. **Layout:** staged wizard for identity, enrollment, household, contacts, documents, consent; import has map → validate → preview → commit → results. **Actions:** save draft, detect duplicate, generate identifier, import valid rows, download error file. **States:** duplicate candidate, invalid section, partial import, stale template. **Acceptance:** idempotency key per import, row-level reasons, no partial hidden writes. **Exclude:** spreadsheet upload directly into tables.

## PA-05 — Guardian and household management

**Routes:** `/dashboard/guardians`, `/guardians/[id]`, `/households/[id]`. **Objective:** model one guardian across siblings, contact preferences, custody/authorization, billing responsibility, and portal access. **Layout:** guardian directory; household graph; child relationship cards; consent and access timeline. **Actions:** link/unlink with effective dates, mark primary contact/payer, invite portal, restrict pickup/contact. **States:** unverified contact, duplicate guardian, disputed relationship, no portal access. **Acceptance:** unlinking does not erase history; only authorized users see custody notes. **Exclude:** copying guardian records per child.

## PA-06 — Transfers, promotions, and placement history

**Routes:** `/dashboard/students/transfers`, `/promotions`, `/students/[id]/placement`. **Objective:** move learners across sections/branches/years using previewable batches. **Layout:** source/destination filters, eligibility/exceptions table, impact preview, batch result. **Actions:** promote, retain, transfer, defer, rollback unconsumed batch. **States:** destination full, unpaid-policy warning, conflicting active enrollment, partially completed. **Acceptance:** effective-dated transactions, unique active placement, downstream schedule/fee impact preview. **Exclude:** overwriting current class fields.

## PA-07 — Academic structure workspace

**Routes:** `/dashboard/academics`, `/academic-years`, `/terms`, `/classes`, `/sections`, `/subjects`. **Objective:** define academic structure and lifecycle. **Layout:** hierarchy navigator with detail pane, status and usage counts. **Actions:** create, clone from prior year, activate, archive unused definition, close term. **States:** draft, active, closed, archived, in-use. **Acceptance:** cannot delete referenced nodes; closing explains consequences. **Exclude:** coupling display names to stable IDs.

## PA-08 — Class offerings and subject assignment

**Routes:** `/dashboard/academics/offerings`, `/offerings/[id]`, `/subjects/assign`. **Objective:** turn definitions into term/section-specific teaching offerings. **Layout:** matrix by section and subject; detail includes teacher, room, periods, capacity, assessment policy. **Actions:** assign/reassign with effective date, copy matrix, detect gaps. **States:** unstaffed, overallocated teacher, missing subject, archived source. **Acceptance:** assignment history retained and conflicts surfaced before publish. **Exclude:** attaching one permanent teacher directly to a subject definition.

## PA-09 — Teacher assignment and workload

**Routes:** `/dashboard/teachers/assignments`, `/teachers/[id]/workload`. **Objective:** balance teaching assignments while respecting qualification, availability, and workload limits. **Layout:** workload summary, assignment grid, conflict panel, history. **Actions:** propose, confirm, bulk-copy, end assignment. **States:** overload, double booking, outside contract, pending approval. **Acceptance:** server recomputes conflicts; teacher sees only effective assignments. **Exclude:** silent override of conflicts.

## PA-10 — Schedule builder, publish, and personal schedules

**Routes:** `/dashboard/schedules`, `/schedules/builder`, `/schedules/conflicts`, `/teacher-schedule`. **Objective:** create versioned timetables and publish a consistent snapshot. **Layout:** week grid with class/teacher/room views, unplaced lessons drawer, conflict inspector, version controls. **Actions:** drag/place, auto-suggest, validate, compare versions, publish, rollback to previous published version. **States:** draft, conflict, validating, published, superseded. **Acceptance:** accessible non-drag alternative, timezone-safe periods, atomic publish, cached portal read model invalidated. **Exclude:** AI/autoscheduler making unreviewed final choices.

## PA-11 — Rooms and capacity

**Routes:** `/dashboard/academics/rooms`, `/rooms/[id]`. **Objective:** manage teaching spaces, features, capacity, maintenance blocks, and utilization. **Layout:** room table/map-neutral list, calendar, utilization metrics sourced from published schedules. **Actions:** create, block, assign feature, export schedule. **States:** unavailable, overcapacity, maintenance. **Acceptance:** room conflicts prevent schedule publish. **Exclude:** live location surveillance.

## Verification prompt

Test admission conversion idempotency, duplicate detection review, one canonical guardian across siblings, restricted custody visibility, effective-dated placement, schedule collision prevention, atomic publishing, closed-term behavior, tenant/branch/class scope, import retries, RTL and mobile directory/detail flows.
