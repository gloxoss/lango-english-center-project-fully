# Section 07: Transfers — real KPIs

## Overview
Implements the PRD's "Transfer activity numbers" Must Have. The transfer action itself (confirmed by research as fully real, direct, no approval workflow per the explicit discovery decision) is untouched. This section only adds two real, cheap aggregates on top of existing data: transfers this month (from `auditLogs`) and students per branch (from `branches`/`user`).

## Risk: green - two read-only aggregate queries over already-real, already-indexed data
No writes, no new tables, no capability changes.

## Dependencies
- **Depends on:** none (no schema dependency on section-01)
- **Blocks:** none
- **Parallel batch:** 1

## TDD Test Stubs
- Test: The transfers-this-month count matches a manual count of real `auditLogs` rows with `entityType='student_transfer'` created in the current calendar month.
- Test: The per-branch headcount matches a manual count of real students (`role='student'`) grouped by `branchId`.
- Test: KPIs for one tenant never include another tenant's transfer or student counts.

## Tasks

<task type="auto" id="07-01">
  <name>Build transfer stats endpoint</name>
  <files>src/app/api/students/transfer-stats/route.ts</files>
  <action>
    New file. GET handler, cap `students.read`. Query 1: `count(*)` from `auditLogs` where `tenantId` matches context, `entityType = 'student_transfer'`, `action = 'update'`, `createdAt >= <first day of current month>`. Query 2: group real `user` rows by `branchId` where `role = 'student'`, `userStatus = 'active'` (excludes withdrawn/inactive students from the headcount, per the review decision that this KPI should reflect current enrollment), and `tenantId` matches context, joined to `branches` for the name, returning `{branchId, name, studentCount}[]`. Return `{success: true, data: {transfersThisMonth, byBranch}}`.
  </action>
  <verify>Call the route against a real tenant with known transfer history and known branch headcounts; confirm both numbers match a manual `psql` count.</verify>
  <done>GET /api/students/transfer-stats returns real, tenant-scoped transfer and branch-headcount aggregates.</done>
</task>

<task type="auto" id="07-02">
  <name>Add KPI cards to Transfers UI</name>
  <files>src/features/students/ui/student-transfers-client.tsx</files>
  <action>
    Read the existing file. Add a small KPI card row above the existing transfer form, fetching from task 07-01 on mount: one card for "Transferts ce mois-ci", and one card/list per branch showing its real student headcount. A branch or month with zero activity shows a real "0", not a hidden card or an error. Keep the existing search/select/transfer form mechanics completely unchanged.
  </action>
  <verify>In the browser, the KPI numbers shown match the real counts confirmed in task 07-01's verification.</verify>
  <done>The Transfers page shows real transfer-activity KPIs above the unchanged, already-real transfer form.</done>
</task>
