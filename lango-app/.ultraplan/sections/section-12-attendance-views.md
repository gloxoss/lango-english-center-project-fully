# Section 12: Attendance Views

## Overview
Two pages with hardcoded arrays, real backends already exist: `attendance-view.tsx` (INITIAL_ROSTER → api/attendance), `attendance-excuses-view.tsx` (MOCK_EXCUSES → api/attendance/excuses + /document).

## Risk: [green] - backends fully exist and were built/verified in an earlier session pass (per AGENT-HANDOFF.md's attendance module writeup)

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- (Backends already tested - frontend-only wiring.)

## Tasks

<task type="auto" id="12-01">
  <name>Wire attendance-view.tsx to the real attendance API</name>
  <files>src/features/attendance/ui/attendance-view.tsx</files>
  <action>Remove INITIAL_ROSTER. Fetch the real class roster + today's attendance via api/attendance GET, wire the intake form to the real POST batch-record endpoint.</action>
  <verify>tsc --noEmit clean; recording attendance through the UI persists and matches the register lock/reopen lifecycle already built</verify>
  <done>No INITIAL_ROSTER reference remains</done>
</task>

<task type="auto" id="12-02">
  <name>Wire attendance-excuses-view.tsx to the real excuses API</name>
  <files>src/features/attendance/ui/attendance-excuses-view.tsx</files>
  <action>Remove MOCK_EXCUSES. Fetch real data from api/attendance/excuses, wire approve/reject (with the existing mandatory-reason-on-reject requirement) and document upload to api/attendance/excuses/document.</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_EXCUSES reference remains</done>
</task>
