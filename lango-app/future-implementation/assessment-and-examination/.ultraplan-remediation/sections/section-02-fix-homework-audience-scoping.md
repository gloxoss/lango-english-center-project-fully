# Section 02: Fix Homework Audience Scoping

## Overview
Fixes `HomeworkService.getHomeworkForStudent`, which currently returns every published homework in the tenant to every student, ignoring the real `assessmentAudiences` table entirely.

## Risk: green - a real, well-understood query fix against existing schema

## Dependencies
- Depends on: none
- Blocks: section-05
- Parallel batch: 1

## TDD Test Stubs
- Test: A homework targeted at a specific student's ID appears in that student's list and no one else's.
- Test: A homework targeted at a section appears for every student in that section, and no other section.
- Test: A homework targeted at a class-offering appears for students enrolled in that offering.
- Test: Two students in different sections see different homework lists for the same tenant.

## Tasks

<task type="auto" id="02-01">
  <name>Real audience-matching in getHomeworkForStudent</name>
  <files>src/features/assessment/services/homework-service.ts</files>
  <action>
    Resolve the calling student's real `classSectionId` (from `user`), then their section (`classSections.sectionId`) and the set of class-offering IDs their class participates in (via `classSubjects.offeringId` where `classSubjects.classId = classSections.classId`, non-null values only). Join `assessmentAudiences` and filter to rows where `studentId = <this student>` OR `sectionId = <student's section>` OR `classOfferingId IN <student's offerings>`. A homework with zero audience rows (broadcast to everyone) should still be included, matching current behavior for that case. Match this codebase's real query style, not a mocked/simplified version.
  </action>
  <verify>Create two real homeworks in a test tenant - one targeted at a specific section, one at a specific student outside that section - and confirm each of two real students in different sections/identities sees only the correct one(s).</verify>
  <done>Homework visibility is genuinely scoped by real audience targeting, not tenant-wide.</done>
</task>
