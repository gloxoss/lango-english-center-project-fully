# ADR 001: Session-Scoping Migration Design for Academic Management

**Date:** 2026-08-05  
**Status:** Accepted  
**Author:** Oussama Zaki (Zakio) / Execution Agent  

---

## 1. Context & Problem Statement

In SchoolOS / Lango, academic setup constructs—such as class-subject assignments, teacher assignments, and timetable schedule slots—were historically bound directly to `classSectionId`. While `sessionYears` existed, `classSections` were treated as timeless structure entities.

This created several operational limitations for schools:
1. **Inability to prepare next year's setup concurrently**: An administrator could not set up next year's subject hours, class teachers, or timetables while the current academic year was active without overwriting live data.
2. **Loss of historical context**: Reassigning a teacher or altering weekly subject hours mutated existing records without preserving past session states.
3. **Rigid capacity tracking**: Section capacity is inherently session-dependent (room availability changes per year), but capacity had no place on timeless class sections.

To support seamless school year transitions, Lango requires a session-scoped academic offerings model.

---

## 2. Decision

We will introduce a dedicated **`academicClassOfferings`** entity that explicitly pairs a `classSection` with a specific `sessionYear`.

### Key Architectural Choices:
1. **New `academicClassOfferings` Table**:
   - `id`: UUID (Primary Key)
   - `tenantId`: UUID (Multi-tenant isolation)
   - `sessionYearId`: UUID (FK `sessionYears`)
   - `classId`: UUID (FK `classes`)
   - `sectionId`: UUID (FK `sections`)
   - `capacity`: Integer (Nullable per-year capacity)
   - `status`: Enum (`active`, `inactive`, `archived`)
   - `displayOrder`: Integer
   - Unique constraint: `(tenantId, sessionYearId, classId, sectionId)`

2. **Additive `offeringId` Linkage**:
   - Add a nullable `offeringId` column to `classSubjects`, `classTeachers`, `subjectTeachers`, and `classScheduleSlots`.
   - Retain `classSectionId` on all 4 tables for full backward compatibility and zero disruption to legacy readers.

3. **Default Session Backfill**:
   - Every existing `classSection` receives exactly **one** offering record created under the tenant's current default session (`isDefault = true`).
   - All existing rows in `classSubjects`, `classTeachers`, `subjectTeachers`, and `classScheduleSlots` have their `offeringId` backfilled by joining `classSectionId` to that tenant's default session offering.

4. **Archive over Destructive Deletion**:
   - Academic records (offerings, class-subjects, teacher assignments, timetable versions) use status enums (`archived`) or `isActive = false` flags.
   - Deleting a `classSubject` or `academicClassOffering` referenced by student placements, assessments, or attendance records returns `409 IN_USE`.

---

## 3. Alternatives Considered

### Alternative A: Add `sessionYearId` directly to `classSections`
* **Description**: Turn `classSections` itself into a session-scoped table.
* **Why Rejected**: `classSections` is referenced in over 100 files across Students, Finance, Attendance, and Auth. Making it session-scoped would require breaking schema changes, massive data duplication for unchanged sections, and risk corrupting live multi-tenant student links.

### Alternative B: Replace `classSectionId` everywhere with `offeringId`
* **Description**: Deprecate `classSectionId` immediately and rewrite all API routes and UI components.
* **Why Rejected**: High collision risk with concurrent sessions, massive blast radius across 5 domains. The additive `offeringId` approach permits progressive adoption while keeping legacy routes 100% functional.

---

## 4. Archive & Deletion Policy

| Entity | Strategy | Constraints / Guard |
|---|---|---|
| `academicClassOfferings` | Archive (`status = 'archived'`) | Soft delete only. Rejects deletion if referenced by active schedule slots or placements. |
| `classSubjects` | Protected Delete / Archive (`isActive = false`) | Returns `409 IN_USE` if linked to `assessmentPlans`, `subjectTeachers`, or `classScheduleSlots`. |
| `classTeachers` | Historical Closure (`endsOn = CURRENT_DATE`) | Closed atomically on reassignment. Never deleted if historical placements exist. |
| `timetableVersions` | Version Lifecycle (`draft` → `published` → `archived`) | Only one active `published` version per tenant+session. Previous version archived on publish. |
| `promotionBatches` | Reversion Audit (`status = 'reverted'`) | Rollback is all-or-nothing and rejected if downstream attendance/invoices exist. |

---

## 5. Inventory of `classSectionId` Read & Write Sites

The following inventory details all codebase locations that reference `classSectionId`, organized by domain:

### A. Core Database Models (`src/models/Schema.ts`)
- `user.classSectionId`: Primary student section placement.
- `classSubjects.classSectionId`: Subject assigned to class section.
- `classTeachers.classSectionId`: Homeroom / class teacher assignment.
- `subjectTeachers.classSectionId`: Subject teacher assignment.
- `classScheduleSlots.classSectionId`: Timetable slot allocation.
- `studentPlacements.classSectionId`: Historical placement ledger record.

### B. Academics Domain (`src/app/api/academics/` & `src/features/academics/`)
- `src/libs/services/timetable-validation.ts`: Validates slot overlaps by `classSectionId`.
- `src/app/api/academics/class-subjects/route.ts`: Subject assignments CRUD.
- `src/app/api/academics/class-teachers/route.ts`: Class teacher assignments CRUD.
- `src/app/api/academics/subject-teachers/route.ts`: Subject teacher assignments CRUD.
- `src/app/api/academics/timetable-slots/route.ts`: Schedule slot CRUD.
- `src/features/academics/ui/class-subjects-client.tsx`: UI view for subject management.
- `src/features/academics/ui/class-section-teachers-client.tsx`: UI view for teacher management.
- `src/features/academics/ui/schedule-client.tsx`: Interactive timetable grid.

### C. Students Domain (`src/app/api/students/` & `src/features/students/`)
- `src/libs/services/student-placement.ts`: Executes student placement and promotion changes.
- `src/app/api/students/route.ts`: Filters student directory by `classSectionId`.
- `src/app/api/students/promotions/route.ts`: Bulk promotion execution.
- `src/app/api/students/promotions/preview/route.ts`: Promotion recommendations.
- `src/app/api/students/transfers/route.ts`: Section transfer management.
- `src/features/students/ui/students-list-view.tsx`: Student directory filters.
- `src/features/students/ui/promotions-view.tsx`: Student promotion workspace.
- `src/features/students/ui/student-transfers-view.tsx`: Section transfer modal.

### D. Attendance Domain (`src/app/api/attendance/` & `src/features/attendance/`)
- `src/app/api/attendance/route.ts`: Daily & session attendance recording by section.
- `src/app/api/attendance/kiosk/route.ts`: QR kiosk check-in verification.
- `src/features/attendance/ui/attendance-client.tsx`: Attendance register grid.
- `src/features/attendance/ui/qr-kiosk-view.tsx`: Student QR scanner logic.

### E. Finance & Billing Domain (`src/app/api/finance/`)
- `src/app/api/finance/invoices/route.ts`: Batch invoice generation by `classSectionId`.
- `src/features/finance/ui/accountant-portal-view.tsx`: Tuition fee allocation filters.

### F. Communication Domain (`src/features/communication/`)
- `src/features/communication/ui/broadcast-send-view.tsx`: Section-targeted SMS/Email broadcasts.

---

## 6. Verification & Compliance

This decision document has been verified against:
- `SCHOOLOS-AGENT-MASTER-PROMPT.md` multi-tenancy and audit directives.
- `MIGRATION-NOTES.md` Drizzle ORM snapshot chain safety rules.
- Existing `studentPlacements` and `promotionBatches` schema patterns.
