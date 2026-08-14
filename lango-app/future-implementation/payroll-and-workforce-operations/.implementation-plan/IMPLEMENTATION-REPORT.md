# Payroll & Workforce Operations — Implementation Report

Status recorded 2026-08-09.

## Delivered backend V1

- `payroll-workforce` is enabled and depends on `human-resources`.
- Granular configuration, calculation, review, approval, posting, payment, leave, advance, award, sensitive-read, and self-service capabilities are registered.
- Migrations `0094`, `0099`, and `0106` provide versioned rules and structures, immutable results and traces, accounting mappings, payments, leave transactions, advance schedules, awards, lifecycle constraints, and replay protections.
- The exact-money engine uses integer cents, constrained formulas, effective-dated Morocco configuration, deterministic traces, proration, adjustments, awards, advance recovery, minimum-net protection, and JSON-safe snapshots.
- The run service implements draft → calculating → calculated → under_review → approved → posted → paid → closed, plus reversal, maker/checker separation, frozen results, numbered issued payslips, and accounting exception handling.
- Payroll consumes Office Accounting posting contract 1.0 and never inserts journal entries directly.

## Verified evidence

- Full repository TypeScript: exit 0.
- Workforce/payroll unit suites: 37/37 passed.
- Live PostgreSQL lifecycle: all assertions passed with isolated-tenant teardown.
- Migration 0094: 35/35 structural checks; migration 0099 passed.
- Tenant scanner: zero Payroll/Workforce findings.
- Isolated production Docker build: exit 0.

## Operational UI delivered (Part 4)

- Guarded Workforce hub and navigation for cycles, regulation, settings, components, structures, assignments, adjustments, payslips, payments, leave, advances, and awards.
- Tenant/add-on/capability-gated APIs for configuration resources, immutable publication actions, run list/create/detail, calculation/review/approval/posting/closing/reversal, and payment batches.
- Run review exposes employee totals and deterministic traces; lifecycle controls call the verified state-machine service rather than changing browser-only state.
- Payment batches enforce posted-run eligibility, uniqueness, advisory locking, maker/checker approval, reconciliation, and reversal.
- The former leave/advance/award fixture-array screens now read and mutate real APIs.

## Honest remaining scope

Authenticated browser acceptance remains required for French/Arabic/RTL visual quality, mobile and keyboard behavior, and the complete two-user maker/checker flow. DAMANCOM and bank exports remain disabled and legally uncertified. The UI identifies shipped rules as configured, not legally certified; qualified Moroccan professional review remains outside software acceptance.

Accurate verdict: **Payroll V1 backend and operational browser surface implemented; browser acceptance and external compliance certification remain.**
