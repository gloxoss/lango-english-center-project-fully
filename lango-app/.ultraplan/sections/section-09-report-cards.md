# Section 09: Report Card Generator

## Overview
`report-card-generator-view.tsx` hardcodes 5 students with fake scores, zero fetch calls. No report-card/bulletin API exists, but the real grading engine (`moroccan-grade-engine.ts`, `assessmentResults`, `calculateClassRanks`) already exists and is used by the real `academics/class-results` route (per this session's earlier audit of Phase 2/3 claims) - this section wires the report-card UI to that same real data instead of duplicating grade logic.

## Risk: [yellow] - must reuse the existing grading engine correctly rather than re-deriving averages/ranks a second way (two different average calculations for the same data would be a real bug, not just a style issue)

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 2

## TDD Test Stubs
- Test: report card for a real student's real assessmentResults matches the same average/rank the class-results route already computes for that student (consistency check, not a new calculation)

## Tasks

<task type="auto" id="09-01">
  <name>Build a report-card data route reusing the existing grading engine</name>
  <files>src/app/api/students/report-card/route.ts (new) - reuses src/libs/grading/moroccan-grade-engine.ts, does not reimplement it</files>
  <action>
    GET ?studentId=&sessionYearId= (or similar scoping already used by class-results). Pull the student's assessmentResults, run them through the SAME calculateMoroccanAverage/calculateClassRanks functions academics/class-results already calls - import and reuse those functions directly, do not copy their logic. Return per-subject scores, overall average, class rank, mention (via getMoroccanMention). requireCapability(context, 'grading.read') for teacher/admin viewing, or self-scoped for a student/parent viewing their own child's card.
  </action>
  <verify>cross-check output against academics/class-results for the same student - numbers must match exactly</verify>
  <done>Route returns real per-student report-card data, provably consistent with the existing class-results calculation</done>
</task>

<task type="auto" id="09-02">
  <name>Wire report-card-generator-view.tsx to the real route, remove hardcoded 5-student array</name>
  <files>src/features/academics/ui/report-card-generator-view.tsx</files>
  <action>
    Replace the hardcoded selectedStudents array with a real student picker (reuse whatever student-search/select pattern the app already uses elsewhere, e.g. in transfers or promotions views) feeding into a fetch to the new route. Print/PDF generation: reuse the native-browser-print approach already established in this codebase for invoice-detail-view (window.print()) rather than adding a PDF library - matches an existing precedent, avoids a new dependency.
  </action>
  <verify>tsc --noEmit clean; generating a report card for a real student with real assessmentResults shows real scores, not "16,25/20" placeholders</verify>
  <done>No hardcoded student/score data remains; print output matches real DB state</done>
</task>
