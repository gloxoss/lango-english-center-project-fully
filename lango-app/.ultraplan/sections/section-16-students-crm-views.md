# Section 16: Students/CRM Views

## Overview
Three pages with hardcoded arrays, real backends already exist: `parents-guardians-view.tsx` (MOCK_HOUSEHOLDS → api/students/parents + /link + /[id]), `inquiries-kanban-view.tsx` (MOCK_PROSPECTS → api/crm/inquiries), `admission-requests-view.tsx` (MOCK_CANDIDATES → api/students/admissions).

## Risk: [green] - all backends exist and were verified real this session

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- (Backends already tested this session - frontend-only wiring.)

## Tasks

<task type="auto" id="16-01">
  <name>Wire parents-guardians-view.tsx</name>
  <files>src/features/students/ui/parents-guardians-view.tsx</files>
  <action>Remove MOCK_HOUSEHOLDS, fetch/wire to api/students/parents (+ /link for real guardian-student linking, replacing the free-text name matching this file may still be using per MIGRATION-NOTES.md's documented gap).</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_HOUSEHOLDS reference remains</done>
</task>

<task type="auto" id="16-02">
  <name>Wire inquiries-kanban-view.tsx</name>
  <files>src/features/crm/ui/inquiries-kanban-view.tsx</files>
  <action>Remove MOCK_PROSPECTS, fetch/wire to api/crm/inquiries. Note this file may already be partly real (this session's CRM commit built the Kanban) - check current state before assuming it's still 100% mock, the audit flagged it but another agent may have touched it since.</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_PROSPECTS reference remains</done>
</task>

<task type="auto" id="16-03">
  <name>Wire admission-requests-view.tsx</name>
  <files>src/features/students/ui/admission-requests-view.tsx</files>
  <action>Remove MOCK_CANDIDATES, fetch/wire to api/students/admissions (+ /[id]/stage, /[id]/convert for the stage-machine actions this session verified real).</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_CANDIDATES reference remains</done>
</task>
