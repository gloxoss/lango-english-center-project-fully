# Section 23: Copy-setup-to-next-session workflow

## Overview
The doc's Phase 1 exit criteria in practice: an admin creates a new `sessionYear`, then copies the prior session's offerings (and their linked class-subjects/class-teachers/subject-teachers) into it as a starting point, previewing what will be created before committing. This is what actually delivers "current and next academic years can be configured concurrently."

## Risk: [yellow] - a bulk-copy operation across 4 tables, needs a real preview step to be safe

## Dependencies
- Depends on: section-22
- Blocks: none
- Parallel batch: 1

## TDD Test Stubs
- Test: preview shows exactly what would be created, commits nothing
- Test: commit creates new offerings + linked classSubjects/classTeachers/subjectTeachers rows scoped to the target session, source session rows are untouched
- Test: re-running commit for a session pair that was already copied does not duplicate (idempotency key, matching the promotion batch pattern)
- Test: copying into a target session that already has some offerings only creates the missing ones, doesn't duplicate existing ones

## Tasks

<task type="auto" id="23-01">
  <name>Build POST /api/academics/class-offerings/copy (preview + commit)</name>
  <files>src/app/api/academics/class-offerings/copy/route.ts (new)</files>
  <action>
    Body: { sourceSessionYearId, targetSessionYearId, mode: 'preview' | 'commit', idempotencyKey (required for commit) }. Preview mode: for each active offering in the source session, compute what a copy would create (new offering + its linked classSubjects/classTeachers/subjectTeachers rows scoped via offeringId), returning counts and any offerings that already exist in the target (by classId+sectionId) so those are skipped, not duplicated. Commit mode: same computation, wrapped in a transaction, actually inserts. Idempotency: check for an existing copy operation by (tenantId, sourceSessionYearId, targetSessionYearId, idempotencyKey) before re-running - reuse the same idempotency-key pattern as the promotion batch commit route (recordAudit with a distinguishable action name serves as the idempotency record, since this doesn't need its own ledger table).
  </action>
  <verify>preview then commit against a real tenant with 2 session years; confirm source untouched, target populated correctly, re-commit with same key is a no-op</verify>
  <done>Preview accurately predicts commit's result; commit is transactional and idempotent</done>
</task>

<task type="auto" id="23-02">
  <name>Minimal UI to trigger copy-setup</name>
  <files>src/features/academics/ui/session-copy-view.tsx (new), src/app/[locale]/(dashboard)/dashboard/academics/session-copy/page.tsx (new), src/libs/api/portal-manifest.ts, src/components/shared/sidebar.tsx</files>
  <action>
    Source/target session pickers, a "Preview" button showing the counts from preview mode, a "Confirmer la copie" button that commits. Register the new page in both nav files (portal-manifest.ts and the real rendered sidebar.tsx - Section 33 will do the full regroup, this just makes the page reachable in the meantime).
  </action>
  <verify>tsc --noEmit clean; preview then commit round-trip in the browser against a real tenant</verify>
  <done>Page reachable from the sidebar, preview/commit both work against the real route</done>
</task>
