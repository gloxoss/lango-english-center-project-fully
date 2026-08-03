# Section 19: NOT CHECKED Verification Sweep

## Overview
~45 pages the audit confirmed have `fetch`/`useSWR`/`useQuery` calls present but did not read in depth (presumed wired, not verified). This section is a lighter-weight confirmation pass, not a rebuild - the goal is to catch any of these that turn out to have *decorative* fetches (data fetched but not actually rendered, or actions that still don't persist) that the presence-only grep couldn't distinguish from genuinely working pages.

## Risk: [green] - verification only; any real issue found here becomes a new small follow-up task, not fixed inline (keeps this section's own scope bounded)

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- (Verification task - produces findings, not code changes, so no test stub of its own.)

## Tasks

<task type="auto" id="19-01">
  <name>Spot-check the academics NOT CHECKED list</name>
  <files>src/features/academics/ui/{academic-calendar,class-detail,class-results,conflicts,evaluations,grade-entry,mediums,optional-subjects,question-bank,sections,semesters,shifts,streams,subjects,teacher-profile}-view.tsx (read only)</files>
  <action>For each, confirm the fetched data is actually rendered (not fetched-and-ignored) and that at least one write action (if the page has one) performs a real persisted mutation, not just a local state update. Report findings as a short list: file, verdict (real / has an issue), one-line detail if an issue exists.</action>
  <verify>read-only</verify>
  <done>All 15 files confirmed real, or specific issues logged as new follow-up items (not fixed inline)</done>
</task>

<task type="auto" id="19-02">
  <name>Spot-check the remaining NOT CHECKED list (attendance, communication, dashboard, finance, settings, students, teachers, super-admin)</name>
  <files>attendance-audit-view.tsx, attendance-flag-detail-view.tsx, attendance-flags-view.tsx, broadcast-send-view.tsx, sms-reminders-view.tsx, sms-templates-view.tsx, analytics-view.tsx, dashboard-view.tsx, expenses-view.tsx, invoice-detail-view.tsx, invoices-view.tsx, payment-entry-view.tsx, access-reset-view.tsx, audit-logs-view.tsx, branches-manage-view.tsx, cndp-view.tsx, staff-view.tsx, matricules-view.tsx, promotions-view.tsx, student-admission-view.tsx, student-attendance-heatmap.tsx, student-photos-view.tsx, student-profile-view.tsx, students-list-view.tsx, super-admin-*.tsx (4 files), teachers-bulk-import-view.tsx, teachers-manage-view.tsx (read only)</files>
  <action>Same verification approach as task 19-01, applied to this larger remaining list. Given the volume, prioritize the ones most likely to be user-facing/high-traffic first (students-list-view, dashboard-view, invoices-view, teachers-manage-view) if time-boxing is needed.</action>
  <verify>read-only</verify>
  <done>All files confirmed real, or specific issues logged as new follow-up items</done>
</task>
