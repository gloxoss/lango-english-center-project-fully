# Section 20: ADR — Session-Scoping Migration Design

## Overview
Formalizes, in-repo, the decision already made in Discovery (new `academicClassOfferings` table, additive `offeringId` linkage, full backfill into each tenant's default session) plus the doc's own Phase 0 exit criteria: an inventory of every place `classSectionId` is read, and archive/delete rules for the academic records this plan touches. No schema or route changes — this section is documentation + inventory only, which is why it's the lowest-risk section and the one everything else depends on.

## Risk: [green] - pure documentation/inventory, no code or schema change

## Dependencies
- Depends on: none
- Blocks: section-21
- Parallel batch: 1

## TDD Test Stubs
- (Documentation section - no test stub of its own. Section 21's tests will exercise the decisions recorded here.)

## Tasks

<task type="auto" id="20-01">
  <name>Write the ADR document</name>
  <files>future-implementation/academic-management-enhancement/ADR-001-session-scoping.md (new)</files>
  <action>
    Write a short ADR (Architecture Decision Record) capturing: the decision (new `academicClassOfferings` table, not extending `classSections`), the alternatives considered (extend `classSections` directly, replace `classSectionId` everywhere), why additive-`offeringId`-alongside-`classSectionId` was chosen (avoids a breaking migration across dozens of files that join on `classSectionId`), the backfill rule (every existing `classSection` gets one offering row in the tenant's default session), and the archive/delete rule for academic records touched by this plan (archive via `status`/`isActive` flags, never hard-delete a row referenced by assessments/timetable/promotions - matches the pattern `studentPlacements` already uses).
  </action>
  <verify>Read back - does it clearly answer "why not just add sessionYearId to classSections" for a future reader?</verify>
  <done>ADR-001-session-scoping.md exists, covers decision/alternatives/rationale/backfill-rule/archive-rule</done>
</task>

<task type="auto" id="20-02">
  <name>Inventory every classSectionId read site</name>
  <files>future-implementation/academic-management-enhancement/ADR-001-session-scoping.md (append)</files>
  <action>
    Grep the codebase for `classSectionId` across `src/app/api/**` and `src/features/**`. List every file that reads or writes it, grouped by module (academics, attendance, finance, grading, students). This is the concrete evidence for why an additive approach was chosen over a replace-in-place one, and becomes the reference list for anyone later deciding whether a route should be updated to prefer `offeringId` once Section 22 lands.
  </action>
  <verify>Cross-check the list against a fresh grep - nothing missing</verify>
  <done>Inventory appended to the ADR, organized by module, matches a fresh grep</done>
</task>
