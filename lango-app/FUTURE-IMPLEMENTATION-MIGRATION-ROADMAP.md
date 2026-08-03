# Future Implementation Migration Roadmap

## Goal

Migrate the planned Lango school-management features in an order that protects existing data, establishes shared foundations once, and lets every later add-on reuse stable permissions, settings, academic records, finance, files, notifications, and reporting.

This is the master execution order. The linked documents remain the detailed specifications for each module.

## Priority rules

- **P0 — Foundation/mandatory:** security, tenancy, authoritative records, money correctness, migrations, and tests. Do not skip.
- **P1 — Core operations:** daily workflows required by most schools and primary users.
- **P2 — Add-on expansion:** valuable independent modules that can ship after their dependencies.
- **P3 — Scale/differentiation:** external presence, advanced automation, analytics, and optimization.
- A phase may start only when its entry dependencies are complete.
- Every module must be hidden behind an entitlement/feature flag until its migration, permissions, tests, and rollback checks pass.
- Migrate data before switching reads; switch reads before retiring old writes.

## Critical path

`Migration safety → Settings/security/permissions → Student and academic truth → Daily academic operations → Finance ledgers → Primary portals → Operational add-ons → Reporting and scale`

## Master priority list

### 0. Establish the migration safety baseline — P0

Complete this before feature development.

- [ ] Inventory the production schema, migrations, tenant keys, roles, routes, background jobs, uploads, and external providers.
- [ ] Create tested database and object-storage backups and document restore steps.
- [ ] Add a migration ledger and CI check preventing duplicate, unordered, or destructive migrations.
- [ ] Establish tenant-isolation tests for every tenant-owned table and API.
- [ ] Add feature flags/module entitlements with per-tenant enablement and emergency kill switches.
- [ ] Establish audit events, structured logs, error monitoring, job monitoring, and data-reconciliation reports.
- [ ] Add contract, migration, permission, and smoke-test suites; capture the current behavior as a baseline.
- [ ] Define zero-downtime migration conventions: additive schema first, backfill, dual-read verification, cutover, then cleanup.

**Exit gate:** a staging restore succeeds; migrations run forward on a production-like copy; tenant-leakage tests pass; every new module can be independently disabled.

### 1. Build shared platform foundations — P0

1. Implement [Settings Platform](future-implementation/settings-platform/SETTINGS-PLATFORM-ENHANCEMENT-PLAN.md) phases A–B:
   - typed settings registry, validation, tenant/branch scope, secret storage, version history, test-connection actions, and cache invalidation;
   - school identity, locale, timezone, currency, numbering, communication, payment, live-class, attendance, and portal settings.
2. Implement [Role Portals Foundation](future-implementation/role-portals-foundation/ROLE-PORTALS-MASTER-PLAN.md):
   - capability-based authorization, data scopes, portal manifests, role-aware navigation, impersonation controls, and permission audit tests.
3. Implement [Two-Factor Authentication](future-implementation/two-factor-authentication/TWO-FACTOR-AUTHENTICATION.md), starting with super-admin, school admin, finance, and HR roles.
4. Implement only the entitlement core from [Subscription and Licensing](future-implementation/subscription-licensing/SUBSCRIPTION-AND-LICENSING-SYSTEM.md): module keys, tenant grants, limits, grace periods, and audit events. Defer commercial billing automation to Phase 13.
5. Introduce shared services used by all add-ons: file/media service, notification outbox, scheduled-job framework, export service, document renderer, and audit trail.

**Exit gate:** permissions deny by default; scoped users cannot access another branch/tenant; secrets are encrypted and masked; settings changes are versioned; an add-on can be installed, enabled, disabled, and rolled back safely.

### 2. Make people and academic records authoritative — P0

Execute in this order:

1. [Admission and Student Model](future-implementation/admission-and-student-model/ADMISSION-AND-STUDENT-MODEL-ENHANCEMENT.md)
2. [Academic Management Enhancement](future-implementation/academic-management-enhancement/ACADEMIC-MANAGEMENT-ENHANCEMENT.md)
3. Employee identity foundation from [Human Resources and Employee Management](future-implementation/human-resources-employee-management/HUMAN-RESOURCES-EMPLOYEE-MANAGEMENT.md)

Required outcomes:

- [ ] Stable student, guardian, household, employee, enrollment, academic-year, class, section, subject, teacher-assignment, and status identifiers.
- [ ] Effective-dated enrollment and placement history instead of overwriting prior years.
- [ ] A canonical class/section/subject/teacher relationship reused by attendance, homework, exams, live classes, fees, reports, and portals.
- [ ] Duplicate detection and merge workflows for students, guardians, and employees.
- [ ] Import validation, preview, error files, idempotency, and reconciliation.
- [ ] Data backfill from current records with an exception queue for ambiguous mappings.

**Exit gate:** each active learner has exactly one valid placement per applicable period; historical records remain reproducible; teacher and guardian scopes resolve from authoritative relationships.

### 3. Complete core teaching and learning workflows — P0/P1

1. Implement the secure core of [Attendance and QR Enhancement](future-implementation/attendance-qr-enhancement/ATTENDANCE-QR-ENHANCEMENT-PLAN.md): manual/session attendance first, then signed rotating QR, replay protection, device/time/location policies, corrections, and audit history.
2. Implement [Assessment and Examination](future-implementation/assessment-and-examination/ASSESSMENT-AND-EXAMINATION-IMPLEMENTATION.md): terms, exam setup, schedules, question banks, marking, grades, moderation, publication, report cards, and online exams.
3. Implement [Attachments Book](future-implementation/attachments-book/ATTACHMENTS-BOOK-ADDON.md) as the common learning-resource/file layer.
4. Connect homework, submissions, evaluation, resources, attendance, and assessment to the canonical academic model and notification outbox.
5. Start the semantic catalog and query guardrails from [Advanced Reporting](future-implementation/advanced-reporting/ADVANCED-REPORTING-ADDON-PLAN.md), but publish only reports backed by completed domains.

**Exit gate:** a teacher can complete one full class cycle—resource/homework, attendance, assessment, feedback, and publication—without administrator-level access.

### 4. Migrate finance safely — P0

Finance is a separate controlled workstream and must use decimal money, immutable posted events, idempotency, period controls, and reconciliation.

1. Implement [Student Accounting](future-implementation/student-accounting/STUDENT-ACCOUNTING-ENHANCEMENT-PLAN.md):
   - fee types/groups, allocations, invoices, discounts, fines, receipts, credits/refunds, reminders, due balances, online/offline payment allocation, and guardian statements.
2. Implement [Office Accounting](future-implementation/office-accounting/OFFICE-ACCOUNTING-IMPLEMENTATION-PLAN.md):
   - chart of accounts, fiscal periods, double-entry journals, deposits, expenses, vouchers, approvals, bank/cash accounts, reconciliation, and statements.
3. Treat Student Accounting as a receivables subledger; post summarized, traceable journals into Office Accounting.
4. Add payment-provider adapters through Settings, using server-side secrets, signed webhooks, idempotency keys, settlement reconciliation, and refund workflows.
5. Run old and new balance calculations in parallel until totals match by student, invoice, account, tenant, and period.

**Exit gate:** opening balances reconcile; every receipt has an allocation and accounting trace; trial balance nets to zero; duplicate webhooks cannot duplicate money; period close and rollback drills pass.

### 5. Deliver the primary portals — P1

Portals reuse the foundation from Phase 1 and expose completed domain workflows rather than duplicating business logic.

1. [Teacher Portal](future-implementation/teacher-portal/TEACHER-PORTAL-PLAN.md)
2. [Student Portal](future-implementation/student-portal/STUDENT-PORTAL-PLAN.md)
3. [Parent/Guardian Portal](future-implementation/parent-guardian-portal/PARENT-GUARDIAN-PORTAL-PLAN.md)
4. [Accountant Portal](future-implementation/accountant-portal/ACCOUNTANT-PORTAL-PLAN.md)
5. [Receptionist Portal](future-implementation/receptionist-portal/RECEPTIONIST-PORTAL-PLAN.md)

Recommended releases:

- **5A:** Teacher portal—today view, assigned classes, attendance, homework/resources, marks, schedules, messages.
- **5B:** Student and parent portals together—schedule, attendance, work, results, invoices/payments, documents, notices, consent/privacy controls.
- **5C:** Accountant portal—receivables, cashier, reconciliation, approvals, close status, finance reports.
- **5D:** Receptionist portal—enquiries, appointments, admissions intake, visitor/front-desk workflows, permitted student lookup.

**Exit gate:** every portal passes capability, tenant, branch, relationship, and object-level authorization tests; mobile and accessibility smoke tests pass.

### 6. Complete workforce operations — P1

1. Finish [Human Resources and Employee Management](future-implementation/human-resources-employee-management/HUMAN-RESOURCES-EMPLOYEE-MANAGEMENT.md).
2. Implement [Payroll and Workforce Operations](future-implementation/payroll-and-workforce-operations/PAYROLL-AND-WORKFORCE-OPERATIONS.md): salary templates/assignments, payroll runs, advances, leave, awards, approvals, payslips, accounting postings, and country-specific policy adapters.
3. Release [Employee Self-Service Portal](future-implementation/employee-self-service-portal/EMPLOYEE-SELF-SERVICE-PORTAL-PLAN.md).
4. Release [School Leadership Portal](future-implementation/school-leadership-portal/SCHOOL-LEADERSHIP-PORTAL-PLAN.md) after finance, academics, attendance, and HR KPIs are reliable.

**Exit gate:** a payroll run is reproducible from approved inputs, posts balanced accounting entries, protects confidential pay, and supports controlled reversal.

### 7. Add communications, admissions growth, and synchronous learning — P1/P2

These can proceed in parallel after Phase 1, but integrations should target completed academic/portal domains.

1. [Lead CRM and Broadcast Messaging](future-implementation/lead-crm-and-broadcast-messaging/LEAD-CRM-AND-BROADCAST-MESSAGING.md): CRM pipeline first, then the [Bulk SMS/Email addendum](future-implementation/lead-crm-and-broadcast-messaging/BULK-SMS-EMAIL-ADDENDUM.md).
2. [Live Classrooms](future-implementation/live-classrooms/LIVE-CLASSROOMS-ADDON.md) using provider-neutral meeting adapters and webhook-driven attendance/reporting.
3. [Event Management](future-implementation/event-management/EVENT-MANAGEMENT-ADDON-PLAN.md) with audiences, RSVP/capacity, consent, reminders, check-in, and calendar feeds.

Controls required before broadcast:

- consent and lawful-purpose records;
- suppression lists, quiet hours, sender verification, templates, approvals, rate limits, retry/dead-letter handling;
- per-recipient delivery events and cost reporting;
- no raw provider credentials in client code.

**Exit gate:** messages, meetings, and events are idempotent, auditable, provider-switchable, and respect audience permissions and communication preferences.

### 8. Add operational school modules — P2

Implement each as an independently entitled add-on:

1. [Library Management](future-implementation/library-management/LIBRARY-MANAGEMENT-ADDON-PLAN.md), then [Librarian Portal](future-implementation/librarian-portal/LIBRARIAN-PORTAL-PLAN.md).
2. [Inventory Management](future-implementation/inventory-management/INVENTORY-MANAGEMENT.md), including stock movements and optional accounting postings.
3. [Student Transport](future-implementation/student-transport/STUDENT-TRANSPORT-ADDON.md): routes, stops, vehicles, drivers, assignments, trips, check-in/out, guardian alerts, and tracking controls.
4. [Hostel Management](future-implementation/hostel-management/HOSTEL-MANAGEMENT-ADDON.md): buildings, rooms/beds, allocations, occupancy, incidents, visitors, charges, and welfare checks.
5. [Guard/Security Portal](future-implementation/guard-security-portal/GUARD-SECURITY-PORTAL-PLAN.md) after transport/hostel/event check-in contracts are stable.

**Exit gate:** each module owns a clear bounded data model, exposes audited APIs/events, honors tenant/branch scope, and can be disabled without corrupting core school records.

### 9. Add the shared document-design and credential suite — P2

Build one neutral template/rendering engine, then ship:

1. [Card and Admit Card Management](future-implementation/card-and-admit-card-management/CARD-AND-ADMIT-CARD-MANAGEMENT.md)
2. [Certificate Management](future-implementation/certificate-management/CERTIFICATE-MANAGEMENT.md)

The engine should support versioned templates, variable schemas, preview, layout/page sizes, QR verification, batch generation, print-ready PDF, revocation, issuance history, accessibility metadata, and tenant branding.

**Exit gate:** an issued document is reproducible from an immutable template version and snapshot, publicly verifiable without exposing private data, and revocable with a complete audit trail.

### 10. Expand reporting domain by domain — P2

Continue [Advanced Reporting](future-implementation/advanced-reporting/ADVANCED-REPORTING-ADDON-PLAN.md) after each source domain reaches its exit gate.

Publish in this order:

1. Student/admission/class/section reports.
2. Attendance and academic-progress reports.
3. Fees/receipts/due/fine reports.
4. Financial statements and income-versus-expense reports.
5. HR/payroll/leave reports.
6. Examination/report-card/tabulation reports.
7. Library, inventory, transport, hostel, events, communications, and live-class reports.

Use governed report definitions, row-level security, asynchronous exports, snapshots for official documents, data freshness indicators, drill-through lineage, and reconciliation against operational totals.

**Exit gate:** every financial total reconciles to its ledger; every report enforces the same data scope as its source workflow; large exports cannot overload transactional APIs.

### 11. External presence and lifecycle portals — P2/P3

1. [School Website CMS](future-implementation/school-website-cms/SCHOOL-WEBSITE-CMS.md)
2. [Custom Domain](future-implementation/custom-domain/CUSTOM-DOMAIN.md)
3. [Alumni Portal](future-implementation/alumni-portal/ALUMNI-PORTAL-PLAN.md)

The CMS should consume approved events, admissions content, news, documents, and forms through public-safe APIs. Custom domains require automated DNS verification, certificate lifecycle, tenant routing, abuse controls, and rollback. Alumni records should be lifecycle projections, not copies that diverge from student history.

**Exit gate:** publishing has preview/approval/version rollback; tenant domains cannot cross-route; public APIs expose no protected student or employee data.

### 12. Advanced differentiation — P3

Only after the relevant basic workflows are stable:

- Offline-capable QR attendance and supervised device stations.
- Live vehicle telemetry, geofencing, ETA prediction, and route optimization.
- Assessment analytics, item analysis, question-quality signals, and moderated AI assistance.
- Finance forecasting, anomaly detection, collections prioritization, and cash-flow planning.
- Cross-domain leadership dashboards and scheduled data warehouse/BI feeds.
- Search across permitted school content, recommendation features, and workflow automation.
- Localization packs, country-specific finance/payroll/tax adapters, and advanced accessibility.

Every AI or predictive feature needs human review, explainability appropriate to impact, opt-out controls, data minimization, and bias/privacy evaluation.

### 13. Commercial scale and final consolidation — P3

1. Finish the commercial portions of [Subscription and Licensing](future-implementation/subscription-licensing/SUBSCRIPTION-AND-LICENSING-SYSTEM.md): plans, metering, quotas, trials, invoices, renewals, dunning, and support overrides.
2. Consolidate duplicate providers, jobs, exports, templates, audit logs, and file handling into the shared services created in Phase 1.
3. Remove legacy writes only after at least one stable release with matching reconciliation.
4. Run penetration, privacy, disaster-recovery, load, accessibility, localization, and cross-browser/mobile testing.
5. Produce operator runbooks, tenant migration playbooks, administrator guides, support diagnostics, and module uninstall/data-retention policies.

**Final gate:** production restore and rollback drills succeed; SLOs and alerts are active; security/privacy review passes; finance and reporting reconcile; tenant-by-tenant rollout and support procedures are approved.

## Recommended delivery batches

Use these batches as manageable releases rather than attempting every module at once.

| Batch | Scope | Business result |
|---|---|---|
| **A — Safe foundation** | Phases 0–1 | Secure, configurable, entitlement-aware platform |
| **B — School system of record** | Phase 2 | Trusted student, academic, guardian, and employee data |
| **C — Teaching core** | Phase 3 | Attendance, resources/homework, exams, marks, and early reports |
| **D — Financial core** | Phase 4 | Reconciled fees, payments, accounting, and statements |
| **E — Primary users** | Phase 5 | Teacher, student, parent, accountant, and reception experiences |
| **F — Workforce** | Phase 6 | HR, payroll, employee self-service, and leadership oversight |
| **G — Engagement** | Phase 7 | CRM, communication, events, and live learning |
| **H — Operations** | Phases 8–9 | Library, inventory, transport, hostel, security, cards, certificates |
| **I — Intelligence and presence** | Phases 10–11 | Governed reporting, CMS, domains, and alumni |
| **J — Differentiation and scale** | Phases 12–13 | Advanced automation, commercial scale, and consolidation |

## Work that may run in parallel

- After Batch A, the academic-record stream and employee-identity stream may run concurrently.
- After Batch B, teaching workflows, finance foundations, and provider adapters may run concurrently with separate migration owners.
- Portal shell/design work may start early, but a portal workflow cannot ship before its domain API and authorization scope pass their gates.
- Library, inventory, transport, hostel, events, and document generation may run in parallel after shared platform services are stable.
- Reporting infrastructure may develop continuously; individual report packs ship only after their source domains reconcile.

## Definition of done for every phase

- [ ] Product scope and out-of-scope items are approved.
- [ ] Data ownership, tenant/branch scope, retention, and deletion behavior are documented.
- [ ] Migrations are additive, idempotent where applicable, tested on a production-like copy, and have a rollback/recovery procedure.
- [ ] APIs and jobs enforce capabilities and object-level scope server-side.
- [ ] Audit, observability, rate limits, idempotency, and failure recovery are implemented.
- [ ] Unit, integration, permission, tenant-isolation, migration, accessibility, and end-to-end tests pass.
- [ ] Imports/backfills produce reconciliation and exception reports.
- [ ] Documentation, feature flags, metrics, support diagnostics, and rollout/rollback runbooks exist.
- [ ] Pilot tenant signs off before staged production rollout.

## Immediate next actions

1. Freeze new unrelated schema work until Phase 0 conventions are agreed.
2. Create the current schema/route/permission/settings inventory and production-like staging copy.
3. Turn Phases 0 and 1 into implementation tickets with owners, estimates, dependencies, and acceptance tests.
4. Select one pilot tenant and define its baseline metrics and reconciliation totals.
5. Begin Settings Platform, Role Portal Foundation, tenant-isolation tests, and entitlement core.
6. Do not begin UI-heavy add-ons until the Phase 1 exit gate passes.

