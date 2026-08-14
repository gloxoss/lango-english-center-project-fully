# Copy-Paste Agent Prompts

Use the agents in the order shown. Foundation and Office Accounting can begin together after the baseline. Parent and Receptionist begin after the Foundation contract is stable. Payroll discovery/configuration can run in parallel, but payroll posting waits for Office Accounting's posting contract.

## Agent 1 — Role Portals Foundation

```text
Implement the Role Portals Foundation from the repository's current real state.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\lango\lango-english-center-project-fully\lango-app

Read fully, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. role-portals-accounting-workforce-wave.md
3. future-implementation/role-portals-foundation/ROLE-PORTALS-MASTER-PLAN.md

First audit existing portal-manifest, permissions, page guards, middleware, role pages and self-service APIs. The repository already has portal work; classify every requirement as reuse, extend, replace or new. Preserve existing roles and data. Build server-owned active-role context, capability plus relationship/branch scopes, manifest-driven navigation/home, shared shell, search/activity/preferences and deny-by-default API/page authorization. A hidden menu item is not authorization.

You own the shared portal contracts. Coordinate all edits to permissions, portal manifest, sidebar and middleware; never overwrite concurrent dirty-worktree changes. Publish a short contract/handoff for Parent, Receptionist, Accountant and Workforce agents before they integrate.

Prove stale-context rejection, multi-role switching, manifest/API agreement, branch and relationship scope, anonymous and wrong-role denial, field redaction, keyboard/mobile/RTL/French behavior, degraded-network behavior, tsc and production build. Record evidence and remaining manual checks honestly.
```

## Agent 2 — Office Accounting

```text
Implement Office Accounting by consolidating the existing Finance domain, not by creating a parallel ledger.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\lango\lango-english-center-project-fully\lango-app

Read fully, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. role-portals-accounting-workforce-wave.md
3. future-implementation/office-accounting/OFFICE-ACCOUNTING-IMPLEMENTATION-PLAN.md

Before coding, inventory the existing finance schema, finance-ledger/gl-auto-post services, accountant APIs/pages, accounting defaults, migrations and tests. Write a reuse/extend/replace map and resolve or explicitly gate the specification's currency, accounting-basis, numbering and approval decisions. Preserve existing invoice/payment/refund/credit-note data and adapters.

Deliver the sequential accounting phases: versioned chart and periods; immutable balanced journal/voucher core; transactional numbering and idempotency; deposits and controlled expenses; maker-checker approvals; reversals; bank reconciliation; financial statements; audit and migration/backfill. All source systems must post through one versioned service. Never hard-delete posted accounting events or duplicate Student Accounting, Payroll, Inventory, Library, Hostel or Transport ledgers.

Coordinate shared schema/journal/permissions/sidebar edits. Prove fixed-precision balance, same-key same-result, changed-payload rejection, concurrent numbering, closed-period rules, reversal linkage, reconciliation, two-tenant foreign-ID rejection, legacy-data preservation, tsc, production build and live PostgreSQL/Docker behavior. Publish the stable payroll posting adapter contract before Payroll integration.
```

## Agent 3 — Parent/Guardian Portal

```text
Implement the Parent/Guardian Portal on the shared Role Portals Foundation and the authoritative guardian-student relationship model.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\lango\lango-english-center-project-fully\lango-app

Read fully, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. role-portals-accounting-workforce-wave.md
3. future-implementation/role-portals-foundation/ROLE-PORTALS-MASTER-PLAN.md
4. future-implementation/parent-guardian-portal/PARENT-GUARDIAN-PORTAL-PLAN.md
5. the Foundation agent's contract/handoff

Audit the existing parent page, ChildContextSwitcher, guardian/student APIs, parent account invitation/linking, Hostel guardian and Transport guardian self-service. Extend these authoritative systems; do not create duplicate children, guardians, invoices, attendance or messages.

Deliver household home and child switching, child overview, published academic results/homework, attendance and excuses, relationship-scoped finance, meetings/messages, requests/documents/consents and preferences. Every request must resolve an effective relationshipId server-side, per-child rights and custody/legal restrictions; revocation must take effect immediately. Minimize and redact data across children and guardians.

Stay within parent feature/API paths and use adapters for Finance, academics, Hostel and Transport. Prove cross-child and cross-guardian denial, sibling non-leakage, revoked/expired relationship denial without relogin, custody restrictions, unpublished-result denial, secure invitation behavior, tenant isolation, manifest/API agreement, mobile/RTL/accessibility, tsc, build and authenticated browser evidence.
```

## Agent 4 — Receptionist Portal

```text
Implement the Receptionist Portal as a least-privilege front-desk workspace using the shared Role Portals Foundation.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\lango\lango-english-center-project-fully\lango-app

Read fully, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. role-portals-accounting-workforce-wave.md
3. future-implementation/role-portals-foundation/ROLE-PORTALS-MASTER-PLAN.md
4. future-implementation/receptionist-portal/RECEPTIONIST-PORTAL-PLAN.md
5. the Foundation agent's contract/handoff

Audit the existing receptionist page/view, CRM inquiries and follow-ups, admissions conversion, Guard visitor/pickup flows and communication templates. Replace mock data with authoritative adapters; do not duplicate CRM leads, students/guardians, appointments, visitor records or Finance.

Deliver front-desk home, consent-aware deduplicated inquiry intake, follow-ups and admissions handoff, rate-limited masked people lookup, appointments, visitor/pickup handoff, approved-template communications and operational tickets. Receptionist alone cannot convert admissions, browse directories, export raw lists, send arbitrary bulk messages or access Finance. Cashier behavior requires a separate explicit assignment and server-side capability.

Prove enumeration resistance, minimum search length/rate limits/audit, sensitive-field redaction, explicit pickup authority, visitor trail, wrong-branch and cross-tenant denial, no-Finance behavior with and without cashier assignment, manifest/API agreement, mobile/RTL/accessibility, tsc, production build and authenticated live browser flows.
```

## Agent 5 — Payroll & Workforce Operations

```text
Implement Payroll & Workforce Operations by extending the completed HR employee foundation and consolidating the repository's existing payroll, leave, advance, award and employee self-service work.

Working directory:
C:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\lango\lango-english-center-project-fully\lango-app

Read fully, in order:
1. future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md
2. role-portals-accounting-workforce-wave.md
3. future-implementation/human-resources-employee-management/HUMAN-RESOURCES-EMPLOYEE-MANAGEMENT.md
4. future-implementation/payroll-and-workforce-operations/PAYROLL-AND-WORKFORCE-OPERATIONS.md
5. future-implementation/payroll-and-workforce-operations/REFERENCE-REPOSITORIES-AND-COMPLIANCE.md
6. the Foundation and Office Accounting agents' contracts/handoffs

Start with a real-state audit of HR profiles, migrations/0043 and 0073-0075, payroll-engine, payroll periods/templates/assignments/payslips, workforce pages, leave/advance/award surfaces and employee self-service. Produce a reuse/extend/replace map. Never duplicate employee identity or use student leave/attendance.

Gate unresolved product choices explicitly. Do not present Moroccan tax/CNSS/AMO rates, DAMANCOM or bank exports as production-ready without current official specifications and qualified professional validation. GPL/AGPL repositories are inspiration only; do not copy code.

Implement addon/dependency enforcement; protected payroll profiles; effective-dated settings and rule packs; versioned components/structures/assignments; safe formula DAG; adjustments; deterministic calculation traces; immutable run/review/approval/result/payslip lifecycle; maker-checker rules; Office Accounting posting; payment/reconciliation; append-only leave and advance ledgers; awards; employee self-service and privacy controls. Posted results reverse/replace and payments cannot duplicate.

Prove professionally approved golden cases before production use, effective-date and proration boundaries, formula cycles/rounding, repeatability, concurrent runs, leave reservation/cancellation, advance double-recovery prevention, balanced/idempotent accounting posting, double-payment prevention, salary/bank/medical field authorization, cross-tenant isolation, addon disable/dependency failure, migration rerun, tsc, production build and Docker/live HTTP behavior. Clearly separate automated evidence, human compliance sign-off and pending external-integration tests.
```
