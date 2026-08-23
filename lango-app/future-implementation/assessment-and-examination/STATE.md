# Assessment & Examination Add-on — Implementation State

**Last verified: 2026-08-13 (direct code inspection; online-exam addon decision executed).**

Status: 🟠 PARTIAL — core shared ledger, homework, and Exam Master are real and wired.
The original larger scope (online-exam addon: question bank runner, live monitor,
accommodations, question groups/blueprints, QTI import/export) was never built, and
its dead scaffolding (`OnlineExamService` + unreachable 0060 tables) has now been
retired — see "Online-exam addon decision" below.

This file previously read "Current Phase: Phase 0 (Schema & Shared Assessment Ledger),
Status: IN_PROGRESS" — that was stale from the very start of the work and never updated
as the plan progressed far past Phase 0. Corrected below.

## What is actually built and wired (verified 2026-08-11)

- **Migration `0060_assessment_and_examination.sql`** exists at `migrations/0060_assessment_and_examination.sql`
  and is registered in `migrations/meta/_journal.json` (tag `0060_assessment_and_examination`). 22 tables.
- **Shared assessment ledger**: `assessmentDefinitions`, `assessmentOutcomes`,
  `assessmentOutcomeRevisions` etc. in `src/features/assessment/models/assessment-schema.ts`,
  driven by `src/features/assessment/services/outcome-service.ts` (`OutcomeService`).
  Consumed internally by `exam-master-service.ts`, `homework-service.ts`, and
  `online-exam-service.ts` (all three call `OutcomeService.recordOutcome`).
- **Homework rework**: `src/features/assessment/services/homework-service.ts`
  (`HomeworkService`), wired to real routes:
  `src/app/api/academics/homework/route.ts`,
  `src/app/api/academics/homework/[id]/grade/route.ts`,
  `src/app/api/academics/homework/[id]/submit/route.ts`,
  plus guardian-portal consumers
  (`src/app/api/guardian/me/children/[relationshipId]/{homework,overview}/route.ts`).
- **Exam Master**: `src/features/assessment/services/exam-master-service.ts`
  (`ExamMasterService`), wired to real routes:
  `src/app/api/academics/exam-terms/route.ts`,
  `src/app/api/academics/exam-halls/route.ts`,
  `src/app/api/academics/exam-schedules/route.ts`,
  `src/app/api/academics/exam-terms/[id]/{marksheet,rankings,seat-allocation}/route.ts`.
  Exam terms/halls/schedules, capacity-aware seat allocation, mark-entry grid, and
  rankings are real and callable.
- **Tests**: `src/features/assessment/__tests__/assessment.test.ts` — 11 `it()` cases
  covering exam-hall time-overlap conflict detection, deterministic capacity-aware seat
  allocation, and homework audience scoping. (A prior report in this folder claimed
  "15 tests" — the actual count in the one test file that exists is 11. Not a material
  gap, just correcting the number since we're being precise here.)
- **Online exam feature that is actually live in production routes today** is the
  **legacy, pre-existing one from migration `0025_add_online_exams.sql`**
  (tables `online_exams`, `online_exam_questions`, `online_exam_question_options`,
  `online_exam_attempts`, `online_exam_answers`, Drizzle models in `src/models/Schema.ts`),
  served by `src/app/api/academics/online-exams/**` (including
  `src/app/api/academics/online-exams/submit/route.ts`, which received a real
  remediation: per-attempt deadline is now `startedAt + durationMinutes`, not just the
  exam's overall `endsAt`). This is a simple MCQ online exam flow — it works, but it is
  NOT the richer addon (question bank/blueprints/live monitor/accommodations) the
  original plan scoped.

## What is NOT built / NOT wired

- **`OnlineExamService`** and its dedicated question-bank/online-exam tables from
  migration `0060` — **retired 2026-08-13** (see "Online-exam addon decision" below).
  The code and its exclusively-owned schema are gone; the legacy `0025` flow is the
  one true implementation.
- Server-timed attempt runner UI, live candidate monitor, auto-save UI, manual-grading
  tasks queue, accommodations (extra time / assistive settings) — none of this exists,
  and none of it is planned unless a future pass explicitly decides to build it fresh.
- Question groups/blueprints, QTI export/import — not built.
- UI workspaces for Homework/Exam Master/Online Exams beyond what's listed above as
  wired — not verified beyond the API layer in this pass.

## Online-exam addon decision — EXECUTED 2026-08-13 (Path A: retired)

Full root-cause writeup and executed resolution: see "Online-Exam Table Collision —
Decision Record" in `EXECUTION-AUDIT-REPORT.md`. Summary: `OnlineExamService`
(`src/features/assessment/services/online-exam-service.ts`) had zero route consumers
and its own `online_exam_attempts` table (migration `0060`) never actually existed at
runtime — it collided by name with the table migration `0025` already created, and
`0060`'s `CREATE TABLE IF NOT EXISTS` silently no-op'd against it. The legacy `0025`
flow already covers the real need (student takes an MCQ online exam, gets
auto-scored) and is live and working, so building the richer scaffolded feature set
was judged disproportionate multi-week work versus the value of finally removing a
landmine collision and unreachable code. Executed:

- Deleted `src/features/assessment/services/online-exam-service.ts`.
- Removed its exclusive types from `src/features/assessment/types/assessment-types.ts`
  (`OnlineExamDeliveryDTO`, `QuestionType`, `QuestionDifficulty`, `OnlineAttemptStatus`).
- Removed the "Online Examinations Addon" Drizzle table block (`questionBanks`,
  `questionItems`, `questionOptions`, `onlineExamPolicies`, `onlineExamAttempts`,
  `onlineExamResponses`) from `src/features/assessment/models/assessment-schema.ts`.
- Added `migrations/0117_retire_dead_online_exam_addon.sql`: drops the five tables
  that were genuinely orphaned (`question_banks`, `question_items`, `question_options`,
  `online_exam_policies`, `online_exam_responses`). Deliberately does **not** drop
  `online_exam_attempts` — at the database level that name is the live `0025` table
  (0060's version of it was never physically created), so dropping it would destroy
  production data.
- Fixed a dead insert in `src/scripts/seed-full.ts` that was writing one throwaway row
  into `question_banks` and never using the returned id (the real question-bank-item
  seed rows go into the unrelated legacy `question_bank_items` table).
- Verified: `npx tsc --noEmit` clean; full 118-migration chain applied cleanly (0
  errors) against a genuinely fresh `postgres:16-alpine` container via
  `scripts/migrate-direct-all.ts`, confirmed `online_exam_attempts` in the fresh DB
  still has the exact live 0025 column shape; `npx next build` exit 0; the legacy
  `src/app/api/academics/online-exams/**` routes and `src/models/Schema.ts` tables
  were not touched.

## Completed Steps (historical, unchanged)
- [x] Audit implementation plan and reference standards (`ASSESSMENT-AND-EXAMINATION-IMPLEMENTATION.md` & `REFERENCE-STANDARDS-TOOLS-AND-REPOSITORIES.md`)
- [x] Initialized `EXECUTION-AUDIT-REPORT.md` and `STATE.md`
- [x] Migration `0060_assessment_and_examination.sql` (shared ledger, Exam Master, online-exam-addon tables — the latter unwired, see above)
- [x] Assessment schemas exported (`src/features/assessment/models/assessment-schema.ts`)
- [x] Shared outcome service + outcome revision history (`OutcomeService`)
- [x] Assignments/Homework API reworked (audience scoping, late policies, attempt files) — `HomeworkService`
- [x] Exam Master services (halls, seat generator, conflict-aware scheduler, mark entry grid, ranking service) — `ExamMasterService`
- [x] `npx tsc --noEmit` clean and unit tests passing as of last build check (11 tests in `assessment.test.ts`)

## Next Steps (real, remaining)
- [x] Resolve the online-exam addon — retired 2026-08-13 (see "Online-exam addon decision" above).
- [x] De-mock the online-exams page to the legacy `0025` MCQ routes (list, create, question authoring, real submit + score) — M13 section 01.
- [x] De-mock the homework page (remove demo seed + fake student-submit; keep teacher create/grade) — M13 section 02.
- [x] Verify the exam-master page against a real tenant — M13 section 03.
- [x] Final gates: tsc, vitest, tenant isolation, live HTTP (two tenants), `next build` — M13 section 05. All green 2026-08-14.
