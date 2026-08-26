# UltraPlan State: Assessment & Examination — Remediation

> Auto-managed by UltraPlan. Do not edit manually.

---

## Current Position

- **Phase:** 6 of 6 — COMPLETE
- **Phase name:** OUTPUT
- **Status:** complete (planning and execution both done, live-verified)
- **Last activity:** 2026-08-07 - All 6 sections executed and live-verified against the real running app (Atlas + SchoolOS tenants), not just typechecked. Section-06 live testing reproduced and confirmed-fixed every bug from the original audit (answer-forgery, no-deadline, homework audience leak), exercised the full new Exam Master lifecycle end-to-end via real HTTP + psql verification, and found + fixed one additional live cross-tenant bug during the cross-tenant sweep (exam-schedules/seat-allocation/marksheet routes weren't checking that foreign IDs - examTermId/examHallId/assessmentDefinitionId/studentId - belonged to the caller's tenant). Full findings in PLAN.md's "Review Notes — Section 06 Live Execution Findings". Final `tsc --noEmit`: exit 0. Final `check-tenant-isolation.ts`: same 3 pre-existing out-of-scope files as before, no regressions. Both future-implementation remediation plans (advanced-reporting, assessment-and-examination) are now fully complete.

<!-- Phase names: 1-UNDERSTAND, 2-RESEARCH, 3-PLAN, 4-REVIEW, 5-VALIDATE, 6-OUTPUT -->

---

## Original Idea

Remediate the Assessment & Examination feature. A prior agent session self-reported "100% EXECUTED, INTEGRATED, VERIFIED & DEPLOYED" but an independent audit (this session, 2026-08-06) proved that false. Full audit findings below are the primary input to this plan, same discipline as the advanced-reporting remediation completed immediately before this one.

## Audit Findings (source of truth)

**Already fixed earlier this session (before this remediation plan started):** the live, unauthenticated cross-tenant write + path-traversal vulnerability in the 4 homework routes (`src/app/api/academics/homework/{route,upload/route,[id]/submit/route,[id]/grade/route}.ts`) - confirmed still clean via a fresh `check-tenant-isolation.ts` run.

**Critical/High, still open:**
1. Exam Master (`ExamMasterService`) is well-built (real seat allocator, real time-overlap hall-conflict check, marksheet grid posting through the real `OutcomeService`) but **never wired to any route** - zero API routes exist for exam terms/halls/schedules/seat-allocation, and the UI (`exam-master-view.tsx`-equivalent) is a pure `useState` shell over hardcoded French demo data with zero `fetch()` calls.
2. Online Examinations: same "well-built service, zero wiring" pattern for `OnlineExamService`, but with an added architectural conflict - its schema (`assessment-schema.ts`) defines `onlineExamAttempts` reusing the table name `online_exam_attempts`, which already exists live with an incompatible column shape (`online_exam_id`/`student_id`/`started_at`/`submitted_at`/`score`/`status`, used by the real, reachable `/api/academics/online-exams/*` routes) vs. the new model's (`assessment_definition_id`/`attempt_number`/`deadline_at`/`auto_score`/`final_score`). Migration `0060` silently no-op'd (`CREATE TABLE IF NOT EXISTS`) rather than erroring, so this was never caught.
3. The LIVE, reachable legacy online-exam submit route (`src/app/api/academics/online-exams/submit/route.ts`) has real, live-reachable bugs: submitted `selectedOptionId`'s `isCorrect` is trusted without verifying it belongs to the submitted `questionId` (a client can pair any correct-option ID from elsewhere in the exam to inflate its score); only `endsAt` is checked, never a per-attempt deadline (`startedAt`/`submittedAt` are just set to `now`, elapsed time never measured); no transaction wraps the scoring+insert sequence; the GET route is tenant-scoped but not role/audience-scoped.
4. `HomeworkService.getHomeworkForStudent` (`src/features/assessment/services/homework-service.ts`) filters only by `tenantId`+`type`+`status`, never joins/filters against `assessmentAudiences` - every published homework in the tenant is visible to every student regardless of class/section/audience.
5. `golden-dataset`-equivalent test coverage (`src/features/assessment/__tests__/assessment.test.ts`) mocks the entire `db` module and asserts only `expect(Service).toBeDefined()` for all 4 services - exercises no real business logic, no invariant from the original plan's test matrix.

**Architectural decision this plan makes (not itemized as a "finding" but a scope resolution):** `OnlineExamService` and its parallel `onlineExamAttempts`/`onlineExamResponses` schema in `assessment-schema.ts` will NOT be wired to any route in this remediation. Wiring it up would require either renaming the colliding table (fragmenting the online-exam feature into two parallel, confusing systems) or migrating the live legacy system's real data onto the new shape (a nontrivial, higher-risk data migration well beyond "fix what's broken"). The live, reachable legacy system is what real users can access today - fixing its real, confirmed-live-reachable bugs is higher value and lower risk than activating a second, currently-unreachable, colliding system. `ExamMasterService` has no such collision (its schema - `examTerms`/`examHalls`/`examSeats`/`examSchedules` - is genuinely new, no live equivalent exists) and will be fully wired up.

## What's confirmed genuinely well-built (reuse, do not rewrite)

- `OutcomeService` - correct moderation-state locking, revision audit trail, tenant-scoped. Already wired into `HomeworkService` and (dead-code-wise) `ExamMasterService`.
- Schema modeling for the shared ledger and homework tables (`assessment-schema.ts` core tables) - sound relationally.
- `ExamMasterService.createExamSchedule`'s conflict-detection query - correct time-overlap check, just never called from a route.
- The pre-existing (non-assessment-initiative) `question-bank/route.ts` and `online-exams/[examId]/questions/route.ts` - properly built to this codebase's standard convention, useful as the reference these fixes should match.
- `OnlineExamDeliveryDTO` type (`assessment-types.ts`) correctly omits `isCorrect` at the type level - good design, currently unreachable, will remain unreachable per the architectural decision above (not a loss, since the live legacy system needs its own equivalent protection, addressed directly in its own route fix).

## Codebase Context

Same codebase/conventions as the advanced-reporting remediation immediately preceding this one in the same session: Next.js 15 App Router, TypeScript, Drizzle ORM, PostgreSQL, multi-tenant. Established convention: `requireRequestContext` → `requireTenant` → `requireCapability` → Zod `.strict()` → tenant-scoped Drizzle query → `recordAudit()` → `apiErrorResponse()`.

## Discovery/Research Compression Note

Per explicit user directive mid-session during the advanced-reporting remediation ("dont ask again do the best option always"), this second remediation's discovery and research phases are self-answered rather than run as interactive question loops, using: (a) the confirmed audit findings above, (b) directly transferable decisions already validated for the advanced-reporting remediation (simpler-matching-existing-patterns preference, "fix exactly what's found" scope discipline, one continuous execution pass with live verification at the end, OK to add well-established new dependencies if genuinely needed), and (c) targeted codebase reads for anything not already known. No AskUserQuestion calls in this plan.
