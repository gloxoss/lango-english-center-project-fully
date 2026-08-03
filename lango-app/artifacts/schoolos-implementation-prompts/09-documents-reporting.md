# 09 — Documents and Governed Reporting Prompt Pack

## Shared document contract

One neutral document engine powers IDs, admit cards, certificates, invoices, receipts, report cards, and governed exports. Templates are versioned; issued artifacts store template/data versions, issuer, timestamps, checksum, and revocation status. Generation is queued, retry-safe, tenant-scoped, and produces accessible preview plus print/PDF output.

## DR-01 — Document engine overview and template library

**Routes:** `/dashboard/documents`, `/documents/templates`, `/templates/[id]`, `/jobs`. **Objective:** browse templates by document type/audience/status, identify defaults, and monitor generation. **Layout:** usage/health, filters, thumbnail cards/list, job queue. **Actions:** create from approved starter, duplicate, set default, archive, run test data. **States:** draft, published, superseded, missing asset/font, job failed. **Acceptance:** historical issued documents keep original version. **Exclude:** arbitrary executable HTML or remote scripts.

## DR-02 — Safe template designer

**Route:** `/dashboard/documents/templates/[id]/design`. **Objective:** position approved text, image, QR, barcode, table, and dynamic-field blocks on portrait/landscape canvases. **Layout:** block palette, canvas with rulers/safe/bleed zones, layers, property inspector, data preview, validation. **Actions:** add/reorder/align, bind allowlisted field, preview FR/AR/long values, save draft, publish. **States:** overflow, missing field, low contrast, unsupported font, unsaved. **Acceptance:** keyboard controls, deterministic renderer, sanitization, RTL text, print dimensions. **Exclude:** unrestricted JS/CSS and fields outside document policy.

## DR-03 — Student and employee ID cards

**Routes:** `/dashboard/cards/student`, `/cards/employee`, `/cards/issued`. **Objective:** select eligible people, preview fronts/backs, batch-generate, reissue, and revoke cards. **Data:** identity, photo consent/status, school/branch, identifier, expiry, signed verification token. **Actions:** filter/select, generate, print sheet, reissue lost/damaged, revoke. **States:** missing photo, duplicate active card, expired, revoked, batch partial failure. **Acceptance:** QR is opaque and revocable; batch job and audit. **Exclude:** encoding private PII in QR.

## DR-04 — Admit card templates and generation

**Routes:** `/dashboard/admit-cards/templates`, `/admit-cards/generate`, `/admit-cards/issued`. **Objective:** generate exam-specific cards from published schedule, seat, room, and eligibility data. **Actions:** preview exceptions, approve batch, generate, reissue, revoke. **States:** schedule unpublished, seat missing, learner ineligible, generated, superseded. **Acceptance:** snapshot exam logistics; reissue reason. **Exclude:** manually typing seat data into artwork.

## DR-05 — Certificate definitions and templates

**Routes:** `/dashboard/certificates`, `/certificate-types`, `/templates`, `/templates/[id]/design`. **Objective:** define eligibility, signer/approval, numbering, validity/revocation, and layouts for student/employee certificates. **Layout:** definition workflow plus shared designer. **Acceptance:** separate certificate business definition from visual template. **Exclude:** a template alone granting eligibility.

## DR-06 — Certificate requests, approval, generation, and registry

**Routes:** `/dashboard/certificates/requests`, `/generate`, `/issued`, `/issued/[id]`. **Objective:** intake requests, verify eligibility, approve, issue unique official artifacts, and manage corrections/revocation. **Actions:** request, review, reject with reason, approve, batch issue, download, correct by superseding, revoke. **States:** pending, ineligible, approved, generating, issued, failed, revoked, superseded. **Acceptance:** atomic sequence, checksum, immutable registry, approval separation where enabled. **Exclude:** overwriting an issued PDF.

## DR-07 — Public verification

**Route:** `/verify/document/[token]`. **Objective:** confirm authenticity with minimal disclosure. **Layout:** valid/invalid/revoked state, issuer, type, issue date, masked subject, checksum/download only if policy permits. **Acceptance:** rate-limited opaque token and no enumeration. **Exclude:** exposing birth date, address, grades, or full IDs.

## Governed reporting contract

Every report has an owner, definition, source entities, dimensions, measures, row-level policy, freshness, retention, export limits, and version. Reports query read models/replicas as scale requires; they never bypass tenant/object scope. Empty is not zero.

## DR-08 — Report catalog and runner

**Routes:** `/dashboard/reports`, `/reports/[key]`. **Objective:** discover authorized reports, understand definitions, filter/run, inspect freshness, drill through, and export. **Layout:** catalog grouped by Students, Fees, Financial, Attendance, HR, Examination, Inventory; runner with filter drawer, KPI/table/chart area, definition panel. **Actions:** run, save view, share permitted view, export, schedule. **States:** no data, stale, partial source, queued, failed, forbidden dimension. **Acceptance:** URL-addressable filters, server pagination, export audit. **Exclude:** loading full datasets in browser.

## DR-09 — Report builder and saved views

**Routes:** `/dashboard/reports/builder`, `/saved`. **Objective:** let authorized analysts compose governed fields, filters, grouping, sorting, and visual form without raw database access. **Layout:** dataset selector, approved field catalog, query canvas, preview/sample, policy/estimated-cost warnings. **Actions:** validate, preview, save, publish to role, duplicate. **States:** incompatible measure, excessive range, restricted field, version stale. **Acceptance:** semantic layer only, row-level security enforced server-side. **Exclude:** SQL editor for tenant users.

## DR-10 — Scheduled reports and run history

**Routes:** `/dashboard/reports/schedules`, `/runs`. **Objective:** schedule snapshot generation and secure delivery/storage. **Actions:** schedule, pause, run now, expire/revoke download. **States:** queued, delivered, failed, expired, recipient suppressed. **Acceptance:** permission evaluated at run and access time; sensitive attachments avoided or encrypted. **Exclude:** emailing unrestricted spreadsheets.

## DR-11 — Student report pack

**Report routes:** `/reports/students/login-credentials`, `/admissions`, `/class-section`, `/siblings`. **Objective:** operational lists with explicit privacy. Login credential report shows provisioning/reset status, never passwords; admission report shows funnel/decisions; class report shows enrollment by effective date; sibling report derives shared guardians/households. **Acceptance:** masked contact data, scoped exports. **Exclude:** plaintext credentials.

## DR-12 — Fees report pack

**Routes:** `/reports/fees/summary`, `/receipts`, `/due`, `/fines`. **Objective:** reconcile assessed, discounted, paid, credited, refunded, due, and fine amounts by period/cohort/branch. **Acceptance:** totals trace to invoices/payments and state as-of date. **Exclude:** summing mutable UI values.

## DR-13 — Financial report pack

**Routes:** `/reports/financial/account-statement`, `/income`, `/expense`, `/transactions`, `/balance-sheet`, `/income-vs-expense`. **Objective:** drillable ledger-grounded statements with comparative periods. **Acceptance:** posted journals only by default, basis/currency/period shown, reconciliation to trial balance. **Exclude:** labeling cash movement as income without accounting basis.

## DR-14 — Attendance report pack

**Routes:** `/reports/attendance/students`, `/student-daily`, `/student-overview`, `/employees`, `/exams`. **Objective:** describe attendance sessions, statuses, missing registers, rates, trends, and amendments. **Acceptance:** denominator definition visible; excused/unknown handled separately. **Exclude:** punitive risk score without governance.

## DR-15 — HR, examination, and inventory report packs

**Routes:** `/reports/hr/payroll-summary`, `/leave`; `/reports/exams/report-card`, `/tabulation`, `/progress`; `/reports/inventory/stock`, `/purchases`, `/sales`, `/issues`. **Objective:** produce official payroll/leave summaries, assessment outputs, and stock movement reports from their canonical ledgers. **Acceptance:** compensation privacy; assessment policy version; inventory opening + movements = closing. **Exclude:** rank by default, private leave reasons, direct editable report cells.

## Verification prompt

Test designer sanitization/overflow/RTL, template version immutability, batch retry, sequence collision, QR verification and revocation, report row-level scope, empty-vs-zero, freshness, large exports, expired links, scheduled-run permissions, finance reconciliation, and accessibility of print/PDF output.
