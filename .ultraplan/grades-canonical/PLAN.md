# One grade system + publishing (plan GRADES-CANONICAL-01)

Found 2026-09-25 while verifying STU-PORTAL-02 (antigravity-stu-1 reported the publishing gap; claude-finance traced the wider split). Executor: one agent (AGENT-PROMPT.md). Verifier: a different agent.

## The problem (measured)

1. **Two grade stores.**
   - `assessment_outcomes` (+ `assessment_definitions`): written by teacher grade entry (`OutcomeService.recordOutcome` via `ExamMasterService.saveMarksheetGrid`, `/api/academics/grade-entry`, marksheet). Read by the student and parent portals (`features/assessment/services/published-results.ts`, guardian results/overview).
   - `assessment_results` (+ `assessments`, `assessment_plans`): **written only by `scripts/seed-full.ts:681`** since the legacy `/api/academics/assessments` route was retired (post-audit S06). Still read by `features/academics/services/report-card-service.ts:112`, `app/api/academics/class-results`, `…/assessment-sessions`, `…/classes/roster`, `app/api/analytics`, `app/api/students` (list), `app/api/students/placements/auto`, `app/api/students/promotions/preview`, `libs/services/student-lifecycle.ts`.
   - Consequence: a grade a teacher enters **never reaches report cards, class results, promotions, analytics or placements**.
2. **Nothing publishes grades.** `recordOutcome` writes `moderation_state = 'draft'`; `lockOutcomes` sets `locked`; closing an exam term (`/api/academics/exam-terms/[id]/stage` → `closed`) sets `exam_terms.is_published` but never touches outcomes. Only the seed creates `published` outcomes. Students and parents only see `published` → they never see real grades.
3. Data today: dev and VPS Atlas = 301 legacy results + 200 published outcomes (demo). **VPS Ninos = 0 results, 0 outcomes, 0 issued report cards.** No backfill needed; switch before Ninos enters grades.

## Decisions (defaults; owner can overturn)

| ID | Decision |
|---|---|
| GD1 | **Canonical store = `assessment_outcomes` + `assessment_definitions`.** `assessment_results` becomes read-only legacy (not dropped). |
| GD2 | **Who sees what:** staff screens (report cards, class results, promotions, analytics) use outcomes in states `graded/exempted/absent` of **any** moderation state except draft-withdrawn; families (student/parent portals) see only `published`. |
| GD3 | **Publishing:** closing an exam term publishes that term's outcomes in the same transaction. For assessments outside a term (homework, quizzes), a school_admin/teacher-with-`grading.manage` "Publier les notes" action per assessment definition; plus "Retirer la publication" (back to `locked`) with a reason. Every change audited. |
| GD4 | **Report-card average** = per subject, the mean of normalised /20 scores of that subject's graded outcomes in the term window, weighted by `class_subjects.coefficient` (today's rule, new source). Exempted excluded, absent counts as 0 only if the definition says so (default: excluded). Evaluation weights stay unused (settings OD4). |

## Invariants

- Tenant filter everywhere; existing capabilities; teachers limited to their assigned sections for publishing (reuse `libs/api/teacher-scope.ts`).
- One helper for "outcomes of a student/section in a period" used by all staff readers; the family helper stays `getPublishedResultsForStudent`.
- Already-issued report cards are snapshots: never recomputed.
- No migration drops or rewrites data. Tests on `schoolos_audit` build fixtures through `recordOutcome`, never through legacy tables.

## Sections (hub items `task:grc-NN`)

### GRC-01 Publishing (red)

<task id="01-01">
  <name>Publish / unpublish service</name>
  <files>lango-app/src/features/assessment/services/outcome-service.ts, lango-app/src/features/assessment/__tests__/outcome-publishing.test.ts (new)</files>
  <action>`publishOutcomes(ctx, { assessmentDefinitionId? , examTermId? , tx? })`: sets `moderation_state='published'` on outcomes with status graded/exempted/absent that are not already published; returns the count. `unpublishOutcomes(ctx, { assessmentDefinitionId, reason })` → `locked`. Both tenant-filtered, audited `{count, reason}`.</action>
  <verify>Tests: draft→published count; already published untouched; other tenant untouched; unpublish needs a reason.</verify>
</task>

<task id="01-02">
  <name>Closing a term publishes its outcomes</name>
  <files>lango-app/src/app/api/academics/exam-terms/[id]/stage/route.ts</files>
  <action>When target = `closed`, call `publishOutcomes({examTermId})` inside the same transaction as the stage change (outcomes whose definition belongs to the term's schedules/sessions; trace the link in `exam-master-service.ts`). Re-opening a closed term (if allowed) does not unpublish automatically.</action>
  <verify>Test: close term → the student portal results API returns the new grades; a draft outcome of another term stays hidden.</verify>
</task>

<task id="01-03">
  <name>Publish action for assessments outside a term</name>
  <files>lango-app/src/app/api/academics/assessment-definitions/[id]/publish/route.ts (new), the grade-entry / marksheet UI that lists assessments (add a button + published badge), locales</files>
  <action>POST publish / DELETE unpublish (reason required). school_admin, or teacher with `grading.manage` on an assigned section (403 otherwise). Button "Publier les notes" with a count confirm; badge "Publié" / "Brouillon" per assessment.</action>
  <verify>Route tests (teacher own section 200, other section 403, other tenant 404); screenshot.</verify>
</task>

### GRC-02 Report cards on the canonical store (red)

<task id="02-01">
  <name>Staff outcomes helper</name>
  <files>lango-app/src/features/assessment/services/staff-results.ts (new)</files>
  <action>`getSectionOutcomes(tenantId, classSectionId, {termStart, termEnd})` → rows (studentId, classSubjectId, subjectId, coefficient, normalised /20 score, status, moderationState) for GD2. One query; no N+1.</action>
  <verify>Unit/DB test with 2 students × 2 subjects × 2 assessments.</verify>
</task>

<task id="02-02">
  <name>report-card-service reads outcomes</name>
  <files>lango-app/src/features/academics/services/report-card-service.ts, its tests</files>
  <action>Replace the `assessment_results` query (line ~112) with the helper. Keep the output shape (`ReportCard`), pass mark, eliminatory, mention, rank, class size exactly as today (GD4). Remove now-unused legacy imports.</action>
  <verify>Existing report-card tests rewritten on outcome fixtures pass; a grade entered through `recordOutcome` changes the bulletin; issued snapshots unchanged.</verify>
</task>

### GRC-03 Other readers (yellow; one task per file group)

<task id="03-01">
  <name>Move the remaining readers to the helper</name>
  <files>app/api/academics/class-results/route.ts, app/api/students/promotions/preview/route.ts, app/api/analytics/route.ts, app/api/students/route.ts, app/api/students/placements/auto/route.ts, app/api/academics/classes/roster/route.ts, app/api/academics/assessment-sessions/route.ts, libs/services/student-lifecycle.ts</files>
  <action>Each file: replace the `assessment_results` read with `getSectionOutcomes` (or a per-student variant added to the same helper). Keep response shapes. If a file uses legacy concepts with no outcome equivalent (assessment "sessions"), stop and ask with `say HUMAN:` instead of inventing a mapping.</action>
  <verify>Each route's existing tests pass on outcome fixtures; `grep -rn assessmentResults src --include=*.ts` → only models, seed and legacy scripts.</verify>
</task>

### GRC-04 Seed and demo data (green)

<task id="04-01">
  <name>Seed writes outcomes only</name>
  <files>lango-app/src/scripts/seed-full.ts</files>
  <action>Stop inserting `assessment_results`; make sure the seeded outcomes cover every class section and term used by report cards and promotions (same volume as the legacy seed). Mark a realistic share as published and some as draft.</action>
  <verify>Fresh seed on a scratch DB: report cards, class results and promotions preview show data; student portal shows only the published subset.</verify>
</task>

### GRC-05 Self-check (required)

<task id="05-01">
  <name>End-to-end proof</name>
  <files>lango-app/artifacts/product-enhancements/GRADES-CANONICAL-01/</files>
  <action>On the dev server: as a teacher enter a grade → invisible to the student (draft) → publish → visible to student and parent → appears in the report-card preview and class results. Screenshots of each step (FR desktop, 390 px, AR). Full unit suite on schoolos_audit, check:types, check:isolation, check:i18n:keys, check:ui.</action>
  <verify>Step table with the API responses and screenshots.</verify>
</task>

## Owner steps after deploy

None required for data (Ninos has no grades). Atlas demo report cards will be computed from the 200 seeded outcomes instead of the 301 legacy rows: numbers on Atlas report-card previews will change.
