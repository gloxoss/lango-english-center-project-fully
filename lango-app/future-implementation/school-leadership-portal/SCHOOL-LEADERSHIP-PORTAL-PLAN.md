# School Leadership Portal — Future Implementation Plan

## Goal

Give directors, principals and department heads decision/approval views without granting full school-admin configuration authority.

## Core journeys and pages

- **Leadership home:** attendance coverage/risk, academic publication readiness, enrollment/capacity, receivables summary, workforce exceptions, incidents and approvals.
- **Academic oversight:** class/subject progress, missing registers/marks, moderation/publication, timetable/teacher load and support flags with drill-through only where assigned.
- **Student wellbeing/discipline:** restricted case queues, intervention status and trends; sensitive notes separated by capability.
- **Finance oversight:** aggregate collection/aging/budget/expense and approval queue; individual finance only with explicit permission.
- **Workforce:** staffing/absence/leave coverage and payroll-run summary; salary detail separately restricted.
- **Operations:** events, transport, hostel, library/inventory exceptions and add-on readiness.
- **Reports:** saved/scheduled Advanced Reporting views with small-group suppression and export controls.
- **Approvals:** attendance reopen, results publication, high-value finance/HR actions, policy changes and exceptions.

## Role model and rules

- Leadership is a permission profile with branch/program/department scope, not a single omnipotent `principal` role.
- Dashboard metrics have definitions, freshness/coverage and source links. No fabricated cross-domain “risk score.”
- Approval authority is effective-dated and amount/domain bounded; delegation is explicit and audited.
- `/api/leadership/me/home|approvals|exceptions` composes authorized domain projections without bypassing their field security.

## Delivery

1. Leadership templates/scopes, aggregate home and approval inbox.
2. Academic/attendance oversight.
3. Finance/workforce summaries.
4. Operational add-on exceptions and scheduled reporting.

## Done when

- Department/branch leaders cannot drill outside scope or infer suppressed sensitive groups.
- Approval thresholds/delegations behave consistently across domains.
- Every metric shows definition, freshness and coverage.

