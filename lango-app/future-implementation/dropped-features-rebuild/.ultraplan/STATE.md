# UltraPlan State: Dropped-Features Rebuild (Élèves & Profils / Matières & Classes)

> Auto-managed by UltraPlan. Do not edit manually.
> This file enables session resume and tracks all activity.

---

## Current Position

- **Phase:** 6 of 6
- **Phase name:** 6-OUTPUT
- **Status:** complete (planning only — see note below)
- **Last activity:** 2026-08-06 - Plan finalized, all output files written

> **Execution note (added 2026-08-11):** this file only ever tracked the UltraPlan
> *planning* phases above, not code execution — despite that, the plan WAS subsequently
> executed and is now live-verified: **STATUS: IMPLEMENTED.** Migration
> `0058_dropped_features_rebuild.sql` shipped `question_bank_items`/`question_bank_item_options`,
> `admission_interviews`, `admission_comments`, plus `classes`/`guardian`/`onlineExamQuestions`
> ALTERs; APIs `question-bank`(+copy-into-exam), `homeroom-teacher`,
> `admissions/[id]/{interview,comments,checklist}`, `parents/[id]/{payments,activity}`,
> `transfer-stats` are all live. Only the drag-and-drop schedule grid and interview SMS were
> deferred, per this plan's own explicit exclusions — not gaps. See
> `future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md` (#8) for full verified detail.
> Do not read "Resume action: hand the `.ultraplan/` folder to an execution agent" below as
> meaning execution never happened.

<!-- Phase names: 1-UNDERSTAND, 2-RESEARCH, 3-PLAN, 4-REVIEW, 5-VALIDATE, 6-OUTPUT -->
<!-- Status values: not_started, in_progress, complete -->

---

## Progress

```
[==========] Phase 6/6: OUTPUT - COMPLETE
```

**Phase breakdown:**

| Phase | Name | Status | Started | Completed |
|-------|------|--------|---------|-----------|
| 1 | UNDERSTAND | complete | 2026-08-06 | 2026-08-06 |
| 2 | RESEARCH | complete | 2026-08-06 | 2026-08-06 |
| 3 | PLAN | complete | 2026-08-06 | 2026-08-06 |
| 4 | REVIEW | complete | 2026-08-06 | 2026-08-06 |
| 5 | VALIDATE | complete | 2026-08-06 | 2026-08-06 |
| 6 | OUTPUT | complete | 2026-08-06 | 2026-08-06 |

---

## Idea

Rebuild the 6 dropped/disclosed-as-fake feature areas across Élèves & Profils and Matières & Classes with real schema-backed logic and better UI/UX, per user pre-decisions already made via AskUserQuestion before this plan started:

1. **Households** — a household is the set of guardians who share a linked student (via the existing `guardianStudents` table) — no new households table. Real co-tutors, real emergency contacts, real communication preferences, real payment history (reusing real invoices/payments — explicitly NOT a stored payment card, PCI scope excluded).
2. **Classes** — drop "Teaching models" entirely (duplicates the already-real Mediums concept). Add real `cycle` field, real enrollment capacity on class-sections, real room + main-teacher assignment (reusing the already-real `rooms` and `classTeachers` tables).
3. **Schedule** — real teacher-view/room-view grouping of the already-real `classScheduleSlots` data (no new schema). Drag-and-drop grid explicitly deferred.
4. **Question bank** — add real section/difficulty/subject/cycle fields to `onlineExamQuestions`; add a real reusable cross-exam question bank table with a copy-into-exam action (independent-copy model).
5. **Admission** — new real `admissionInterviews` table (single interview per applicant), new `admissionComments` table (staff-only), a fixed real review checklist.
6. **Transfers** — keep direct-action-only (no approval workflow, per explicit user decision). Add real KPIs (transfers this month, active students per branch) — the transfer action itself confirmed already fully real.

Explicitly excluded: rebuilding the "Création manuelle" duplicate tab in Import massif, the drag-and-drop schedule grid, and interview SMS notification — all confirmed intentional exclusions, not gaps.

Codebase: SchoolOS, Next.js App Router, Drizzle ORM, PostgreSQL. Route convention: `requireRequestContext` → `requireTenant` → `requireCapability` → Zod `.strict()` → tenant-scoped Drizzle query → `recordAudit()` → `apiErrorResponse()`. No new permission/capability strings introduced anywhere in this plan.

---

## Session History

| # | Date | Action | Details |
|---|------|--------|---------|
| 1 | 2026-08-06 | Created | /ultraplan (idea above) — plan isolated to `future-implementation/dropped-features-rebuild/.ultraplan/` since the project-root `.ultraplan/` belongs to the concurrent session's completed, unrelated "Academic Management Enhancement" plan |
| 2 | 2026-08-06 | Phase 1 | UNDERSTAND complete: 18 questions, 9/9 categories (2 fully interactive: Core Requirements, Edge Cases; 7 resolved via established app conventions) |
| 3 | 2026-08-06 | Phase 2 | RESEARCH complete: 1 codebase subagent (web/docs research skipped — no new external tech), 3 refinements found (reuse classTeachers, reuse rooms via new FK, rename field to maxStudents), 0 hard conflicts, user approved all recommended |
| 4 | 2026-08-06 | Phase 3 | PLAN complete: PRD approved in one condensed pass, 8 sections, 29 tasks, 3 parallel batches, risk breakdown 0 red / 4 yellow / 4 green |
| 5 | 2026-08-06 | Phase 4 | REVIEW complete: 8-category self-review found 9 issues (Completeness, Scalability, UX) all auto-fixed; 5 non-obvious refinement questions asked, all recommended options chosen, 1 uncovered a real gap (question-bank DELETE handler was missing) |
| 6 | 2026-08-06 | Phase 5 | VALIDATE complete: 16/16 in-scope requirements traced, 0 gaps, 0 unapproved scope creep, 3 explicit exclusions correctly excluded not silently dropped, user approved |
| 7 | 2026-08-06 | Phase 6 | OUTPUT complete: SUMMARY.md written, all files finalized |

---

## Change Log

<!-- Populated by /ultraplan update command. -->

| # | Date | What Changed | Sections Affected | Details |
|---|------|-------------|-------------------|---------|
| (No updates yet. Use /ultraplan update to modify the plan.) |

---

## Resume Instructions

**Resume from:** N/A — plan is complete.
**Resume action:** To modify, run `/ultraplan update` from within `future-implementation/dropped-features-rebuild/`. To execute, hand the `.ultraplan/` folder to an execution agent per SUMMARY.md's instructions.
**Resume context:** N/A

---

## File Manifest

| File | Status | Last Modified |
|------|--------|---------------|
| .ultraplan/DISCOVERY.md | created | 2026-08-06 |
| .ultraplan/RESEARCH.md | created | 2026-08-06 |
| .ultraplan/PRD.md | created | 2026-08-06 |
| .ultraplan/PLAN.md | created | 2026-08-06 |
| .ultraplan/VALIDATE.md | created | 2026-08-06 |
| .ultraplan/STATE.md | created | 2026-08-06 |
| .ultraplan/SUMMARY.md | created | 2026-08-06 |
| .ultraplan/sections/index.md | created | 2026-08-06 |
| .ultraplan/sections/section-01-schema-foundation.md | created | 2026-08-06 |
| .ultraplan/sections/section-02-households.md | created | 2026-08-06 |
| .ultraplan/sections/section-03-classes.md | created | 2026-08-06 |
| .ultraplan/sections/section-04-schedule-views.md | created | 2026-08-06 |
| .ultraplan/sections/section-05-question-bank.md | created | 2026-08-06 |
| .ultraplan/sections/section-06-admission-review.md | created | 2026-08-06 |
| .ultraplan/sections/section-07-transfer-kpis.md | created | 2026-08-06 |
| .ultraplan/sections/section-08-verification.md | created | 2026-08-06 |
