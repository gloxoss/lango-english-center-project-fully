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

## Findings (19-01, academics batch, 2026-08-04)
10/15 REAL (academic-calendar, class-detail, conflicts, evaluations, mediums, optional-subjects, sections, semesters, shifts, streams, subjects). 4/15 MOCK-DATA, zero persistence, all currently dirty from the other agent's concurrent session (held, not fixed inline per this section's own scope):
- `class-results-view.tsx` — no fetch calls; `STUDENTS`/`CLASS_RESULTS`/`MODERATION_DECISIONS`/`DISTRIBUTION`/`MENTIONS_DIST` all hardcoded; "Publier les résultats" has no handler. Real backing likely exists via the `class-results`/grading-engine route built in Section 14 — needs wiring once file frees up.
- `grade-entry-view.tsx` — despite the name, this is a static exam-taking simulator (timer/flagging/MCQ) on a hardcoded `QUESTIONS` array, not a teacher grade-entry form; zero API calls.
- `question-bank-view.tsx` — only fetches `/api/academics/online-exams` for one decorative stat; entire exam builder runs on `MOCK_EXAM_SECTIONS`/`BANK_QUESTIONS`; Add/Edit dialogs close with no persistence.
- `teacher-profile-view.tsx` (exports `TeacherPortalView`/`TeacherProfile360View`) — zero fetch calls; schedule/classes/homework/messages/stats all hardcoded; action buttons have no handlers.

## Findings (19-02, remaining batch, 2026-08-04)
24/30 REAL. 3 legitimate "coming soon" stubs (`super-admin-subscriptions-view`, `super-admin-subscriptions-list-view`, `super-admin-sms-view` — no fetch by design, not a defect). 5 real problems found, all currently dirty from the other agent's concurrent session (held, not fixed inline):
- `finance/ui/expenses-view.tsx` — zero fetch/useEffect; `EXPENSE_REQUESTS`/`ACCOUNTING_PIECES`/`CASH_DEPOSITS`/`BANK_DEPOSITS` all hardcoded; every action button ("Nouveau dépôt"/"Valider"/"Téléverser") has no handler.
- `finance/ui/invoices-view.tsx` (component `InvoicesFinanceView`) — zero fetch; hardcoded `INVOICES`/`INVOICE_DETAIL`; "Créer une facture"/"Envoyer aux familles"/row checkboxes all no-op. Real backing exists (`/api/finance/invoices`, confirmed real from `invoice-detail-view.tsx`'s own fetch) — just needs wiring.
- `finance/ui/payment-entry-view.tsx` — zero fetch; hardcoded `FAMILIES`/`RECENT_PAYMENTS`/`PENDING_INVOICES`; `handleSave()` is `setSaved(true)` + timeout only, no API call despite implying a real cash-register entry.
- `students/ui/student-profile-view.tsx` (component `StudentPortalView`) — zero fetch; entire portal (courses/homework/grades/attendance/announcements/teacher comments) hardcoded for a fictional "Youssef"; `id`/`locale` props unused.
- `students/ui/students-list-view.tsx` (→ `students-list-page.tsx` → `students-list-client.tsx`, split by the other agent's concurrent restructuring) — list state seeded from `MOCK_STUDENTS`, **never fetches** `/api/students` on mount, so displayed roster never reflects the real DB. Create/Edit/Delete *do* call real `POST`/`PUT`/`DELETE /api/students`, but the UI only mutates its local mock array and never re-fetches — writes are real but invisible until reload, and reload reverts to mocks. Highest-priority fix in this whole sweep: add the missing initial fetch + re-fetch-after-write.
