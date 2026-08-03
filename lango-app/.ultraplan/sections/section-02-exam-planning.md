# Section 02: Exam Planning

## Overview
`exam-planning-view.tsx` shows a hardcoded 3-row `MOCK_EXAMS` array and literal KPI strings ("18 Sessions", "420 Élèves"). No exam-scheduling API exists — `academics/online-exams` (digital exam-taking), `academics/assessment-sessions` (grade-entry test instances), and `academics/room-utilization` (stats only) are different domains. This section builds a real exam-session-planning backend (which rooms/classes/subjects an exam uses and when) and wires the page.

## Risk: [yellow] - new backend, moderate scope, no existing close analog to copy exactly

## Dependencies
- Depends on: none
- Blocks: none (Section 03 Rooms is related but independently useful - don't block on it, use classSectionId/subjectId only for now, room linkage can follow once Section 03 lands)
- Parallel batch: 1

## TDD Test Stubs
- Test: POST /api/academics/exam-sessions rejects a session whose classSubjectId belongs to a different tenant
- Test: GET /api/academics/exam-sessions returns tenant-scoped rows only
- Test: only school_admin can create/edit exam sessions (matches academics.manage convention from this session's wiring pass)

## Tasks

<task type="auto" id="02-01">
  <name>Add examSessions table migration</name>
  <files>migrations/00XX_add_exam_sessions.sql (new), src/models/Schema.ts</files>
  <action>
    New table: id, tenantId, classSubjectId (FK classSubjects), title, examDate, durationMinutes, status (scheduled/completed/cancelled), createdAt. Keep it minimal - no room FK yet (Section 03 hasn't landed), no invigilator assignment (not in the audit's scope, avoid scope creep beyond what the mock UI actually shows).
  </action>
  <verify>docker compose run migrate clean; drizzle-kit check passes</verify>
  <done>Table exists, matches Schema.ts definition exactly</done>
</task>

<task type="auto" id="02-02">
  <name>Build /api/academics/exam-sessions route (GET/POST/PUT/DELETE)</name>
  <files>src/app/api/academics/exam-sessions/route.ts (new)</files>
  <action>
    Follow the academics/assessment-sessions/route.ts pattern closely (same shape: list/create/read a test-like entity under a class-subject). requireRequestContext(['school_admin']), requireCapability(context, 'academics.manage') per this session's established convention for exam/schedule admin routes.
  </action>
  <verify>manual curl round-trip create/list/update/delete against a real tenant</verify>
  <done>Full CRUD works, tenant-isolated, admin-only</done>
</task>

<task type="auto" id="02-03">
  <name>Wire exam-planning-view.tsx to the real route, remove MOCK_EXAMS</name>
  <files>src/features/academics/ui/exam-planning-view.tsx</files>
  <action>
    Replace MOCK_EXAMS with a real fetch to GET /api/academics/exam-sessions. Wire create/edit/delete UI actions to the new route. Replace the 3 literal KPI strings with real aggregates computed client-side from the fetched list (session count, distinct classes, distinct subjects) - do not fabricate a student/teacher count that has no basis in the exam-session data itself.
  </action>
  <verify>tsc --noEmit clean; page shows empty state for a fresh tenant, real rows after creating a session through the UI</verify>
  <done>No MOCK_EXAMS reference remains; KPIs derive from real fetched data</done>
</task>
