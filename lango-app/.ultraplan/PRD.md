# Product Requirements Document (PRD) — Academic Management Enhancement

## 1. What We're Building
The remaining implementation of `future-implementation/academic-management-enhancement/ACADEMIC-MANAGEMENT-ENHANCEMENT.md`: session-scoped academic setup, teacher-role/subject-lifecycle history, a timetable with a real draft/publish lifecycle, a room directory, and a completed promotion workflow (wizard UI, capacity checks, rollback). Two of five phases are already partially shipped this session (promotion ledger backend, timetable write-time validation, teacher schedule) — this plan covers everything still missing.

## 2. The Problem
SchoolOS already has every top-level capability the reference product shows, but several of them are timeless or reactive where the school actually needs them to be session-aware and proactive: a class-teacher assignment has no start/end date, a timetable slot can double-book a teacher and nothing stops it until someone runs a report, and — until this session — a promotion just moved a student's `classSectionId` with no record of the decision behind it. None of this blocks day-to-day use today, but none of it survives a real school year transition either: there's no way to prepare next year's classes while this year is still live.

## 3. Who It's For
`school_admin` configures and manages everything in this plan. `teacher` gets read-only self-scoped views (their own schedule, their own assigned classes/subjects) — never tenant-wide enumeration. `student`/`parent` are out of scope for this plan (their published-schedule read surface is a documented future item, not built here).

## 4. What It Does
- **Session-scoped class offerings**: a new concept links a class/section to a specific school year, with capacity, so next year can be configured while this year stays live and unaffected.
- **Class-teacher roles & history**: distinguishes a primary/homeroom teacher from an assistant, records when an assignment started/ended, and stops two teachers being marked primary for the same offering at once.
- **Subject curriculum metadata**: weekly hours, display order, and an active/archived state on class-subject assignments, with used assignments protected from silent deletion.
- **Timetable lifecycle**: schedules move through draft → published states; only the published version is what teachers/admins see as "the" schedule; a school can prepare a future timetable without touching the live one.
- **Room directory**: a small, real list of physical rooms (name, capacity, type) the timetable and exam-session tooling can reference instead of a free-text label.
- **Promotion wizard**: the existing ledger backend (shipped this session) gets a real UI — per-student decisions defaulted from real grade averages, a capacity warning, and a controlled rollback for a batch that hasn't been built on top of yet.
- **Navigation regroup**: Academic Setup / Timetables / Academic Year Operations, replacing today's flat, partly-unlinked list.

## 5. How It Should Feel
No visual redesign. Same design system already governing this app (slate/blue palette, KPI banners, data-dense tables, inspector sidebars). The promotion wizard and offering/timetable-version workspaces are new screens, built to match the existing pattern exactly — not a new visual language.

## 6. What It Connects To
No external integrations. Pure extension of the existing Drizzle/PostgreSQL/Better Auth stack, same route convention as every prior section this session shipped: `requireRequestContext` → `requireTenant` → `requireCapability` → Zod `.strict()` → tenant-scoped query → `recordAudit()` → `apiErrorResponse()`.

## 7. What It Does NOT Do
- Does not touch the deprecated LMS chain (`academicYears`/`courses`/`studentGroups`/old `timetableSlots`/old `rooms`) — confirmed dead, explicitly out of bounds per the source doc.
- Does not replace `classSectionId` anywhere — every new session-scoped link is additive (`offeringId` alongside it), so no existing route touching `classSectionId` needs to change as part of this plan.
- Does not build a student/parent-facing published-schedule view — flagged in the doc as a future surface, not this plan's scope.
- Does not touch any file this session already shipped (`student-placement.ts`, `timetable-validation.ts`, the promotions/timetable-slots routes) except where a section explicitly extends them.
- Does not proceed past Phase 0 (the ADR) without the schema-approach decision being locked — it already is, per Discovery, but the ADR section formalizes it in-repo for future reference.

## 8. How We'll Know It Works
- Migrations apply cleanly (`docker compose build migrate` + run), verified against the real `_journal.json` ledger, not assumed.
- Every new/changed route: `tsc --noEmit` clean, manual round-trip against a real tenant, tenant isolation holds (cross-tenant IDs rejected).
- Promotion wizard: a batch committed through the UI produces the exact same `promotion_batches`/`promotion_decisions`/`studentPlacements` rows the backend API already produces directly (already verified this session) — the UI is a client of the existing contract, not a new one.
- Timetable publish: a draft with an unresolved conflict cannot be published; a published version is what `teacher-schedule` and `schedule` both read.
- Zero regressions: every section is git-status-checked immediately before execution; nothing here reverts or silently overwrites the other concurrent session's work.

## 9. Business Model
Not applicable — internal admin/academic feature, no billing surface.

## 10. Risks & Concerns
1. **Collision risk, elevated for this plan specifically**: Phase 1's `Schema.ts` changes and Phase 3's timetable-version work touch some of the exact files a concurrent session has repeatedly kept dirty this session (`Schema.ts`, `schedule-view.tsx`, academics UI). Every section's file list is deliberately narrow and the isolated-git-blob commit technique is the default for any shared file, not a fallback.
2. **Migration sequencing**: this plan adds several migrations on top of the `0046` already shipped this session; each section re-checks `migrations/meta/_journal.json`'s true highest `idx` at execution time (the other session creates un-journaled migration files), not at planning time.
3. **Additive-schema tax**: choosing `offeringId`-alongside-`classSectionId` over a full replacement avoids a large breaking migration but means two "which class/section" pointers coexist for a transition period — sections in this plan are explicit about which one they read from and why.
4. **Rollback correctness**: promotion rollback only makes sense while nothing downstream (attendance, grades, invoices) has been recorded against the target placement yet — the rollback section's dependency scan is the safety mechanism, not just a confirmation dialog.
