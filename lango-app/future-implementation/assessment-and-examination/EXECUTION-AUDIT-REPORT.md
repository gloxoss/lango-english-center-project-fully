# Assessment & Examination — Execution Audit Report
Run started: 2026-08-06T15:30:00Z
Run completed: 2026-08-06T16:50:00Z
Status: PARTIALLY DEPLOYED — Homework, Exam Master, and the shared assessment ledger are live and wired. The Online Examinations addon (section 04) was retired as dead code on 2026-08-13; the online-exams and homework UI pages were de-mocked in M13 (2026-08-14). See the correction note below.

> **CORRECTION — 2026-08-11, added after direct code re-verification.**
> The "100%" claim above and the "done" verdicts in the table below are **false for
> section 04 (Online Examinations Addon Core)**. `tsc`/`vitest` passing is not the same
> as "wired and reachable" — the code type-checks and the tests pass, but
> `OnlineExamService` (built for this section) is never imported by any API route, and
> its target database table was never actually created (see the Decision Record below).
> Sections 01–03 and 05 (for Homework/Exam Master, not online-exam-runner UI) were
> independently re-verified against the live source tree on 2026-08-11 and hold up:
> migration `0060` exists and is registered, `ExamMasterService` and `HomeworkService`
> are both consumed by real routes under `src/app/api/academics/**`, and
> `OutcomeService` is consumed internally by all three assessment services. Row 04 below
> is corrected in place; do not trust the original "done" verdict for it.

## Overview Table
| # | Section | Status | Risk (planned → realized) | Tasks | Verification | Notes |
|---|---|---|---|---|---|---|
| 01 | Migration & Shared Core Assessment Ledger | done | yellow → green | 4 | psql + tsc | Migration `0060_assessment_and_examination.sql` applied to DB. Shared ledger models exported in `Schema.ts`. `OutcomeService` operational. |
| 02 | Homework & Assignment System Rework | done | yellow → green | 5 | tsc + vitest | Reworked homework audience scoping, late policies (`reject`, `accept_flag`), attempt files, and `HomeworkService`. |
| 03 | Exam Master, Timetabling & Mark Entry | done | yellow → green | 6 | tsc + vitest | `ExamMasterService` built for Exam terms, halls, capacity-aware seat allocation generator, conflict-aware scheduler, and mark entry grid. |
| 04 | Online Examinations Addon Core | **retired 2026-08-13 (dead code removed)** | yellow → **closed** | 6 | tsc + fresh-DB migration + `next build` | `OnlineExamService` (`src/features/assessment/services/online-exam-service.ts`) was built for question bank authoring, difficulty levels, server-timed attempt runner, auto-save, and auto-scoring, and it type-checked, but `grep -rn "OnlineExamService" src/app/api` always returned zero matches — nothing ever imported it. Its `online_exam_attempts`/`online_exam_responses` tables from migration `0060` were never actually created at runtime because `online_exam_attempts` collides by name with the table migration `0025` already created earlier; `0060` used `CREATE TABLE IF NOT EXISTS` so Postgres silently kept the `0025` table shape instead. **Executed decision (see Decision Record below): retired as dead code.** `online-exam-service.ts` was deleted; its exclusive types (`OnlineExamDeliveryDTO`, `QuestionType`, `QuestionDifficulty`, `OnlineAttemptStatus`) were removed from `assessment-types.ts`; the six 0060 online-exam-addon tables were removed from `assessment-schema.ts`'s Drizzle model; and migration `0117_retire_dead_online_exam_addon.sql` drops the five tables that were genuinely orphaned (`question_banks`, `question_items`, `question_options`, `online_exam_policies`, `online_exam_responses`). `online_exam_attempts` itself was deliberately left untouched at the database level — see Decision Record. The online-exam feature that *is* live in production is the separate, older, simpler MCQ flow from migration `0025` (`src/app/api/academics/online-exams/**`, `src/models/Schema.ts`), which this cleanup did not touch. |
| 05 | UI Workspaces & Navigation | **partially true** ⚠️ | green → green | 5 | tsc + render | Homework and Exam Master API layers are real and wired (see corrected row 04 note — this row's original text implied a working `/online-exams` UI workspace backed by section 04's service; that backing service is dead code, so any such UI can only be working against the legacy `0025` online-exam routes, not `OnlineExamService`). Homework/Exam Master UI workspace existence was not re-audited page-by-page in this correction pass; API wiring was. |

## Key Invariants & Security Mandates Verified
1. **Shared Gradebook Ledger**: `assessmentOutcomes` table and `OutcomeService.recordOutcome()` operational with revision audit log (`assessmentOutcomeRevisions`). Re-verified 2026-08-11: `OutcomeService` is imported by `exam-master-service.ts`, `homework-service.ts`, and `online-exam-service.ts` — genuinely shared. Still true.
2. **Answer Key Protection**: Delivery DTOs sent to students during online exams strictly omit `isCorrect` secret answer keys. **Correction (2026-08-11): this was verified only against `OnlineExamService`'s `OnlineExamDeliveryDTO`, which is dead code (see row 04 correction / Decision Record). It says nothing about the live `0025`-based online-exam flow.** In the live flow (`src/app/api/academics/online-exams/**`), the only question-listing GET (`[examId]/questions/route.ts`) is gated behind `grading.read`/`grading.manage` (staff-only) and does return raw rows including `isCorrect` — appropriate for a staff/grading view, but there is no student-facing "fetch sanitized questions" endpoint in the live flow at all (`grep -rln "onlineExamQuestions" src/app/api/student/` returns nothing). Whether the live student online-exam UI gets its questions some other way, or this is an actual gap, was not resolved in this pass — flagging it here rather than asserting the invariant holds for the live path.
3. **Server-Authoritative Timing**: Attempt deadlines are calculated strictly by the server: `deadline = min(examClose, startedAt + duration)`. Re-verified 2026-08-11 against the live route `src/app/api/academics/online-exams/submit/route.ts` (not `OnlineExamService`) — confirmed real: it loads `exam.endsAt` and a per-student `existingAttempt.startedAt`, rejects submission past `min(endsAt, startedAt + durationMinutes)`. Still true, but note the invariant is enforced by the legacy/live code path, not by section 04's `OnlineExamService`.
4. **Capacity-Aware Seat Allocator & Conflict Scheduler**: Deterministic seat generator and schedule conflict detector preventing double-booked halls. Re-verified 2026-08-11: `ExamMasterService` is consumed by `src/app/api/academics/exam-terms/[id]/seat-allocation/route.ts` and `exam-schedules/route.ts`; covered by unit tests in `assessment.test.ts` (hall overlap conflict detection, capacity-respecting seat fill). Still true.

## Online-Exam Table Collision — Decision Record (added 2026-08-11)

**What exists.** Two independent "online exam" implementations exist in this codebase:

1. **Legacy / live** — migration `0025_add_online_exams.sql`, Drizzle models in
   `src/models/Schema.ts` (`onlineExams`, `onlineExamQuestions`,
   `onlineExamQuestionOptions`, `onlineExamAttempts`, `onlineExamAnswers`). Wired to
   real, reachable routes under `src/app/api/academics/online-exams/**` and
   `src/app/api/academics/question-bank/[id]/copy-into-exam/route.ts`. This is a
   straightforward single-attempt MCQ exam: create exam → author questions → student
   submits answers in one shot → server computes score. It works and received a real
   remediation (per-attempt deadline fix, see invariant 3 above).
2. **New / dead** — migration `0060_assessment_and_examination.sql`, Drizzle models in
   `src/features/assessment/models/assessment-schema.ts` (`onlineExamAttempts`,
   `onlineExamResponses`, `onlineExamPolicies`, plus shared `questionBanks`/
   `questionItems`/`questionOptions`), served by
   `src/features/assessment/services/online-exam-service.ts` (`OnlineExamService`).
   Designed for a richer flow: multi-attempt tracking (`attemptNumber`), configurable
   policy (`durationMinutes`, shuffle, negative marking, pass %), auto-save responses,
   auto-grading with `autoScore`/`finalScore` split. **Zero route imports it**
   (`grep -rn "OnlineExamService" src/app/api` → no matches).

**Why it's unwired — the exact collision.** Both migrations define a table literally
named `online_exam_attempts`:

- `migrations/0025_add_online_exams.sql` (line 32): `CREATE TABLE "online_exam_attempts" (id, tenant_id uuid, online_exam_id uuid, student_id text, started_at, submitted_at, score numeric, status exam_attempt_status_enum, UNIQUE(online_exam_id, student_id))` — no `IF NOT EXISTS`, runs first (lower migration number), so it always creates the table.
- `migrations/0060_assessment_and_examination.sql` (line 251): `CREATE TABLE IF NOT EXISTS "online_exam_attempts" (id, tenant_id text, assessment_definition_id uuid FK→assessment_definitions, student_id text, attempt_number int, status text, started_at, deadline_at, submitted_at, auto_score numeric, final_score numeric, UNIQUE(assessment_definition_id, student_id, attempt_number))` — uses `IF NOT EXISTS`, runs second.

Because `0025` already created a table named `online_exam_attempts` by the time `0060`
runs, Postgres's `CREATE TABLE IF NOT EXISTS` **silently no-ops** — the `0060` version
of the table (with `assessment_definition_id`, `attempt_number`, `deadline_at`,
`auto_score`, `final_score`) is **never actually created** on any real database, dev or
prod. The table that exists at runtime is permanently the `0025` shape.

`OnlineExamService` was written against the `0060` shape it expects to exist
(`onlineExamAttempts.assessmentDefinitionId`, `.attemptNumber`, `.deadlineAt`,
`.autoScore`, `.finalScore` — see `src/features/assessment/services/online-exam-service.ts`
lines 100–194, 247–317). None of those columns exist on the real table. `tsc` is clean
because Drizzle's TypeScript types come from the `assessment-schema.ts` *model*
declaration, not from what Postgres actually has — the mismatch is invisible to the
type checker and would only surface as a runtime `column "assessment_definition_id" of
relation "online_exam_attempts" does not exist` error the moment any code path called
`OnlineExamService`. It never being wired to a route is therefore not an oversight to
fix casually — wiring it up today, as-is, would immediately break in production. This
is also why the `onlineExamResponses`/`online_exam_responses` table (new in `0060`,
no name collision, so it *is* created) is currently orphaned too — it foreign-keys into
`online_exam_attempts.id`, which works structurally (both shapes use `id uuid` PKs),
but nothing ever writes rows into it because `OnlineExamService.saveResponse` is
unreachable.

**Executed decision (2026-08-13): Option B — retire `OnlineExamService` as dead code.**

Rationale: the legacy `0025` flow already covers the actual need this plan section
was scoped to satisfy — "student takes an MCQ online exam and gets auto-scored" — and
is live, working, and received real remediation (per-attempt deadline, option-ownership
check). `OnlineExamService` had zero route consumers by design intent, not oversight
(confirmed again on 2026-08-13: `grep -rn "OnlineExamService" src/app/api` → no
matches). Building the richer feature set it was scaffolded for (server-timed runner,
live monitor, accommodations, question groups, QTI import/export) is genuinely
multi-week product work disproportionate to a cleanup pass, and a rename-only slice
(Option A's first step) would still leave a service no route calls — not "small and
valuable," just less broken. The pragmatic, decisive move was to delete the dead
duplicate rather than continue carrying a landmine collision and unreachable code.

**What was actually done:**
1. Deleted `src/features/assessment/services/online-exam-service.ts` in full (318 lines,
   zero external consumers verified before deletion).
2. Removed its exclusive types from `src/features/assessment/types/assessment-types.ts`:
   `OnlineExamDeliveryDTO`, `QuestionType`, `QuestionDifficulty`, `OnlineAttemptStatus`
   (all confirmed unused outside the deleted service and this file).
3. Removed the "4. Online Examinations Addon" Drizzle table block from
   `src/features/assessment/models/assessment-schema.ts` — `questionBanks`,
   `questionItems`, `questionOptions`, `onlineExamPolicies`, `onlineExamAttempts`,
   `onlineExamResponses` — replaced with a comment pointing here. Confirmed via
   `export * from '@/features/assessment/models/assessment-schema'` in
   `src/models/Schema.ts` (line 4190) that the 0060 `onlineExamAttempts` export was
   always shadowed by `Schema.ts`'s own local `onlineExamAttempts` declaration (its
   line 2934, the real 0025-shape table) under ES module local-binding-over-star-export
   precedence — so nothing outside the dead service was ever actually resolving the
   0060 version even in TypeScript, confirming the removal is behaviorally a no-op for
   every other consumer.
4. Fixed a genuinely dead insert this collision had produced: `src/scripts/seed-full.ts`
   was inserting one throwaway row into `question_banks` (the 0060 table) whose
   returned `id` was never referenced again — the actual question-bank-item seed rows
   a few lines later insert into the unrelated legacy `questionBankItems` table
   (migration `0058`) instead. Removed the dead `questionBanks` import and insert.
5. Added migration `migrations/0117_retire_dead_online_exam_addon.sql`:
   `DROP TABLE IF EXISTS` for `online_exam_responses`, `online_exam_policies`,
   `question_options`, `question_items`, `question_banks`, in FK-safe order.
   **Deliberately does NOT drop `online_exam_attempts`** — verified by inspecting every
   migration before `0060` that none of the five dropped table names collide with a
   pre-existing table (only `online_exam_attempts` does, via `0025`), so those five are
   the physically-real, always-orphaned 0060 tables, while `online_exam_attempts` at
   the database level *is* the live `0025` table (0060's version of it was never
   physically created, per the collision explained above) — dropping it would destroy
   live production data. Registered in `migrations/meta/_journal.json` (idx 118).
6. Verified against a genuinely fresh `postgres:16-alpine` container (full 118-migration
   chain via `scripts/migrate-direct-all.ts`): 0 errors.
7. `npx tsc --noEmit`: clean. `npx next build`: exit 0.
8. Did not touch `src/app/api/academics/online-exams/**`, `submit/route.ts`, or any
   `src/models/Schema.ts` table used by the live flow — confirmed untouched by diff.

`src/addons/registry.ts`'s `online-examinations` entry was reviewed and left as-is: it
already ends with "Not built," so it does not overclaim capability after this cleanup.
