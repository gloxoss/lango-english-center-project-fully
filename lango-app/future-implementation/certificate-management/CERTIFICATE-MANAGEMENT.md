# Certificate Issuance & Verification — Future Addon

**Status: planned, not started.** This specification evaluates the supplied
RamomSchool Certificate pages against the real SchoolOS codebase and adds
the issuance, evidence, approval, verification, correction, revocation, batch,
and delivery logic that the reference navigation does not show.

## Product decision

Build a paid **Certificate Issuance & Verification** addon for:

- Student academic, completion, participation, achievement, and enrollment
  certificates/attestations
- Employee employment, experience, training, appreciation, and service
  certificates
- Visual certificate templates
- Evidence-based eligibility rules and approval
- Individual and bulk issuance
- Secure QR/serial verification
- Correction, replacement, revocation, expiry, and audit history
- Portal download and future email/SMS delivery notifications

The addon should reuse the same internal document-template/generation platform
selected for Card Management (`pdfme`), but it is commercially independent. A
school may buy Certificates without buying Card Management. Shared engine code
belongs in a neutral internal library, not inside one addon importing another
addon's private UI.

## What the reference pages show

The supplied reference has three visible functions:

1. **Certificate Template** — list/create/edit certificate layouts, separated
   by applicable user (student or employee).
2. **Generate Student** — generate student certificates.
3. **Generate Employee** — generate employee certificates.

The template list shows certificate name, applicable user, A4 landscape page
layout, background image, created date, preview/edit/delete, search, export, and
print.

This is a useful starting menu, but a trustworthy certificate product also
needs to answer:

- What exactly did the person earn, and from which source data?
- Who approved and signed it?
- Can a third party verify it?
- What happens after a spelling correction, replacement, or revocation?
- How do we avoid issuing duplicates during a failed bulk job?
- Is the visible signature an image or an actual cryptographic signature?

## Where SchoolOS is today (verified in the repository)

### Existing foundations

- Real tenant-scoped student and staff identities, student matricules, employee
  IDs, names, photos, branches, and statuses.
- Real active academic structure: session years, class sections, subjects,
  assessments/results, attendance, and schedules.
- Tenant logo and branch contact data.
- Teacher/staff employment-related fields such as hire date, qualification, and
  documents; the future HR addon defines the richer employment history needed
  for reliable experience letters.
- `html2canvas`, `jspdf`, audit logs, tenant-aware uploads, and browser print
  patterns.
- The Card addon plan already selects active MIT-licensed `pdfme` for a
  TypeScript/React WYSIWYG designer and vector PDF generation.

### Existing `certificates` table is not a usable foundation

`src/models/Schema.ts` contains a small `certificates` table with only student,
course, issue date, and template name. However:

- It is tied to `courses`, part of the schema chain explicitly documented as a
  dead/unused LMS course platform.
- No source code creates, lists, renders, verifies, corrects, or revokes these
  rows.
- It has no serial number, template version, evidence, approval, status,
  employee support, verification token, issue snapshot, or audit lifecycle.

Do not extend this table incrementally into the new product. Introduce a clean
certificate domain and either leave the legacy table untouched/deprecated or
migrate only genuinely valid historical records through an explicit migration.

### Missing today

- No certificate UI or API.
- No template designer/versioning.
- No definition of certificate types or earning criteria.
- No reliable “program/course completed” source in the active academic model.
- No approval/signatory workflow.
- No serial/QR verification or public certificate page.
- No batch jobs, delivery, correction, replacement, or revocation.
- No email sending infrastructure; delivery cannot be promised until the
  messaging infrastructure exists.

## Addon boundary

### Remains core

- Academic/student/employee source records.
- Grades, attendance, enrollment/class placement, and HR employment history.
- School identity/logo and staff access control.
- Core report cards and legally required ordinary records if product/legal
  decisions later classify them as mandatory rather than optional.

### Belongs to this addon

- Certificate definitions and eligibility policies.
- Certificate template library/designer.
- Student/employee certificate requests, approvals, and issuance.
- Serial/QR verification, public pages, lifecycle, batch jobs, and delivery.
- Optional interoperable digital credentials in a later phase.

Addon deactivation blocks new management and issuance but preserves all records.
Already issued certificates continue to verify unless individually expired or
revoked. A commercial switch must never rewrite historical truth.

## Certificate categories

### Student certificates

- **Enrollment / school-attendance attestation**: confirms the student is
  enrolled in a named session/class as of an issue date. This is not proof of
  course completion.
- **Course/level completion**: confirms completion of a defined learning unit
  after its explicit criteria are met.
- **Achievement/excellence**: tied to a documented assessment/result rule, not
  a manually typed claim without evidence.
- **Participation**: event, workshop, club, or competition participation; may
  not require a score.
- **Attendance**: certifies an evidence-backed attendance period/rate.
- **Training/camp/workshop**: duration, dates, learning outcomes, organizer.

Avoid ambiguous labels such as “school certificate.” Every type must state what
claim it proves and which evidence fields support it.

### Employee certificates

- **Employment certificate**: role/designation and employment dates/status.
- **Experience/service certificate**: verified employment period, department,
  designation, and optionally responsibilities.
- **Training completion**: internal professional-development activity and
  completion evidence.
- **Appreciation/recognition**: named contribution or award with approver.
- **Participation**: staff event/workshop participation.

Employee experience/service certificates should use the future HR addon's
employment history. Before HR exists, restrict these to an authorized manual
request with reviewed evidence; do not infer an official employment history
from a current role and one hire-date field.

## Core domain concepts

### Certificate definition

Defines the claim and policy: category, audience, title, criteria, validity,
approval route, allowed templates, and delivery settings. It is not the visual
design.

### Template/version

Defines appearance and data bindings. Published versions are immutable.

### Award/eligibility evidence

The source facts that justify issuance: student placement, results, attendance,
event participation, manual reviewed evidence, or HR employment history.

### Issued certificate

The permanent credential record with serial, recipient, definition, immutable
template version, evidence snapshot, rendered-data snapshot, approvers,
signatories, status, and verification token.

### Request

An optional workflow item raised by staff/student/parent for certificates that
need review, such as enrollment attestations or experience letters.

### Generation job

A retryable individual/bulk operation with per-recipient success and error
records.

## Page-by-page plan

### 1. Certificate Overview

Route: `/dashboard/certificates`

- Counts: drafts awaiting review, issued this month/session, expiring soon,
  revoked, and failed jobs.
- Breakdown by student/employee and certificate category.
- Quick actions: new definition, new template, issue student, issue employee,
  review requests, and open recent jobs.
- Warnings: unpublished template, missing signer, missing evidence, duplicate
  rules, and delivery failures.

### 2. Certificate Definitions

Route: `/dashboard/certificates/definitions`

- Fields: name, code, audience, category, description/claim, achievement or
  learning outcomes, evidence rule, approval policy, validity/expiry policy,
  default template, languages, portal availability, and status.
- Version criteria/policies. Changing “pass score 60%” must not retroactively
  alter evidence attached to past certificates.
- Duplicate definition instead of rebuilding common policies.
- Archive definitions; do not delete definitions referenced by issues.

#### Eligibility rule builder (bounded, not arbitrary code)

Supported version-1 rules:

- Manual authorized selection with required reason/evidence.
- Active enrollment/class placement for a session/date.
- Assessment/result threshold for selected assessments/plan.
- Attendance percentage over a selected period.
- Event/participation roster membership (requires a small activity/roster model
  if no existing source applies).
- HR employment/training condition when HR is active.

Rules are stored as validated structured JSON/enums. Never accept raw SQL or
JavaScript expressions from administrators.

### 3. Template Library

Route: `/dashboard/certificates/templates`

- Table/gallery filterable by audience, category, language, orientation, status,
  and default.
- Thumbnail, name, page size, version, creator, updated/published dates.
- Actions: preview, duplicate, edit draft, publish version, set default, export
  validated template JSON, and archive.
- Published/in-use versions cannot be changed or hard-deleted.
- Starter templates: formal academic, modern language-course completion,
  participation, excellence, employment, experience/service, and appreciation.

### 4. Certificate Template Designer

Route: `/dashboard/certificates/templates/[id]/edit`

Reuse `pdfme` through a neutral document-studio package shared with Card
Management.

- A4 landscape/portrait presets, plus A5 and custom sizes.
- Background image/color, border, logo, watermark, seal, shapes, SVG, text,
  recipient name, certificate title/body, dates, serial number, QR, signature
  blocks, and result/attendance fields.
- Safe zones, rulers/grid/snapping, layer order, lock, alignment, undo/redo,
  zoom, and overflow warnings.
- Custom Arabic/French fonts, RTL testing, dynamic font sizing for long names,
  and locale-aware date/number formatting.
- Front-only by default. Multi-page supporting transcript/details is a later
  explicit feature, not accidental overflow.
- Data field browser is allowlisted per audience/category. No salary, national
  ID, guardian contact, or other sensitive fields by default.
- Preview with tenant-scoped sample data or privacy-safe fixtures.
- Publication validates required bindings, missing assets/fonts, image
  resolution, QR quiet zone, overflow, and signer placement.

### 5. Student Issuance

Route: `/dashboard/certificates/issue/students`

Flow:

1. Choose definition and session/year.
2. Filter/select class sections or individual students.
3. System evaluates eligibility and groups eligible/ineligible/pending-review.
4. Review evidence and resolved certificate values.
5. Choose published template/language, issue date, and authorized signatories.
6. Preview representative certificates.
7. Submit for approval or issue immediately if policy permits.
8. Generate PDF, verification record, portal publication, and delivery job.

Per-student errors do not fail the entire batch. Ineligibility displays the
exact reason and source correction link.

### 6. Employee Issuance

Route: `/dashboard/certificates/issue/employees`

- Filter/select staff by branch, role, and—when HR is enabled—department,
  designation, employment status, contract dates, or training roster.
- Choose employee certificate definition and verified date range.
- Experience/responsibility narrative supports controlled reviewed text, with
  change history and approval.
- Current staff role is not sufficient proof of historical roles/dates.
- Person may receive an employee certificate even without an application login
  when the HR employee-profile model exists.
- Same preview, approval, issuance, verification, and delivery lifecycle.

### 7. Requests & Approvals

Route: `/dashboard/certificates/requests`

- Requests from authorized staff and, optionally, student/parent/self-service
  portals.
- Request types, purpose (optional/minimized), requested language, delivery
  method, notes, and supporting evidence.
- Statuses: draft, submitted, under_review, changes_requested, approved,
  rejected, issued, cancelled.
- Rejection/changes require a reason visible to the requester.
- Optional four-eyes rule: requester/preparer cannot be final approver for
  official experience or achievement certificates.
- Approval authorizes the claim; rendering is a subsequent idempotent operation.

### 8. Issued Certificates

Route: `/dashboard/certificates/issued`

- Search/filter by serial, recipient, definition/category, audience, status,
  template version, issue/expiry date, approver, and job.
- Actions: view, download, send/publish, print, correct/replace, revoke, and view
  history.
- Statuses: `active`, `expired`, `revoked`, `replaced`.
- Never hard-delete an issued credential through normal UI.

### 9. Certificate Detail & Audit Trail

Route: `/dashboard/certificates/issued/[id]`

- Rendered preview/download.
- Claim, recipient, evidence snapshot, definition/policy version, template
  version, serial, validity, approval/signatory record, delivery state.
- Timeline: requested, reviewed, approved, issued, downloaded, delivered,
  corrected/replaced, expired, revoked, and verification aggregation.
- Internal evidence is permission-restricted and not shown on the public page.

### 10. Generation & Delivery Jobs

Route: `/dashboard/certificates/jobs`

- States: queued, evaluating, awaiting_approval, rendering, delivering,
  partially_completed, completed, failed, cancelled.
- Requested/eligible/issued/skipped/failed/delivered counts.
- Per-recipient errors, exportable error CSV, and retry-only-failed.
- Idempotency prevents duplicate issuance on timeout/retry.
- Generated PDF bundles have retention limits; issued credential records remain.
- Email delivery is enabled only after real email infrastructure exists. Until
  then support portal download/manual PDF and never claim a message was sent.

### 11. Public Verification

Route: `/verify/certificate/[token]`

- No login, rate-limited and abuse-monitored.
- QR contains an opaque high-entropy verification URL/token, never raw student
  ID, email, national ID, or evidence.
- Displays minimum public claim: issuer/school, recipient display name (subject
  to policy), certificate title/category, issue/expiry date, serial, and
  active/expired/revoked/replaced result.
- Optional details: learning outcomes/achievement criteria when intended for
  public verification.
- Generic invalid-token result prevents enumeration.
- Verification proves SchoolOS's issuance record and current status; it is not
  proof of the viewer's identity and does not grant portal access.

### 12. Signatories & Issuer Profile

Route: `/dashboard/certificates/settings`

- Issuer legal/display name, logo, verification contact/URL, locale, serial
  prefix, retention, default validity, and public-display policy.
- Signatory profiles: name, title, signature image, active dates, applicable
  certificate definitions, and ordering.
- Optional seal/stamp asset.
- Signature images are protected tenant assets and cannot be freely downloaded
  from a predictable public URL.
- A visual signature image is **not** a cryptographic digital signature. Label
  the capability honestly.

## Issuance lifecycle

1. Definition and template are drafted/versioned/published.
2. Request or direct issue selects recipients.
3. Eligibility is evaluated against source data and policy version.
4. Evidence/resolved data are snapshotted.
5. Required reviewer(s) approve the claim.
6. System reserves a tenant-scoped unique serial and creates the issue record.
7. PDF generation uses the pinned immutable template version.
8. Certificate is published/delivered and becomes verifiable.
9. Later download/print does not create a second certificate.
10. Correction creates a replacement issue and marks the original replaced.
11. Revocation immediately changes public status but preserves history.
12. Expiry derives from `validUntil`; non-expiring certificates remain active
    until revoked/replaced.

## Correction versus revocation

- **Minor claim/recipient correction**: create a replacement certificate with a
  new serial/token; mark prior one replaced and link both directions.
- **Rendering-only defect before delivery**: if no external copy was released,
  rerender the same issue from the same immutable data/version and record event.
- **Wrong or invalid award**: revoke with restricted reason and approver.
- **Lost PDF**: download again; a PDF is not a physical card and does not need a
  new identity merely because the file was lost.
- Never edit the snapshot behind an already published serial invisibly.

## Evidence and academic truth

Certificate wording must match the evidence:

- Enrollment proves enrollment, not completion.
- Attendance percentage proves recorded attendance over a stated period, not
  competence.
- Assessment threshold proves only the selected assessed outcome.
- Completion requires a real definition of learning unit, period, criteria, and
  source records.
- Participation must not be presented as successful completion unless criteria
  actually say so.

Because SchoolOS's legacy `programs/courses` chain is explicitly inactive, the
implementation must either map completion to the active class/subject/session
model or first introduce a real language-program enrollment/completion domain.
Do not revive dead schema silently just to satisfy the old certificate FK.

## Recommended data model

### `certificateDefinitions`

- `id`, `tenantId`, `code`, `name`, `audience`, `category`, description
- status, default template, validity policy, approval policy
- current policy version, locale/delivery/public-display settings

### `certificateDefinitionVersions`

- definition, version, structured eligibility rules, claim/outcome metadata
- effective dates, creator/publisher and timestamps

### `certificateTemplates` / `certificateTemplateVersions`

- same versioned document-platform concepts as Card Management
- pdfme-compatible validated schema, page/asset/font manifest, thumbnail

### `certificateRequests`

- tenant, requester, recipient type/id, definition, requested locale/method
- status, reviewer, reasons/notes, timestamps

### `issuedCertificates`

- `id`, `tenantId`, unique tenant serial
- recipient type (`student`, `employee`), recipient ID
- definition version, template version, optional request/job
- `publicTokenHash`, issue/validity dates, status
- claim/evidence/render snapshots
- approver/signatory snapshots
- replacement/revocation links and restricted reasons/timestamps/actors
- generated PDF storage reference/hash and timestamps

### `certificateJobs` / `certificateJobItems`

- selection/filter snapshot, state/counters/output expiry
- one item per recipient with eligibility, issue link, and structured error
- idempotency uniqueness per intended award/recipient/policy period

### `certificateEvents`

- append-only issue/download/delivery/replace/revoke/verification-summary events

### `certificateSignatories`

- tenant, name/title, protected signature asset, active dates, status

Every record is tenant-scoped. Recipient, definition, source evidence,
signatory, actor, and template relations must be tenant-consistent.

## Serial number and token policy

- Human serial example: tenant-defined prefix + year + collision-safe sequence,
  such as `LNG-2026-000123`; uniqueness is enforced in the database.
- Serial numbers are searchable/public identifiers, not secrets.
- Public QR token is separate, random, high entropy, and stored hashed.
- Verification by manually entered serial may require an additional short
  verification code to reduce enumeration.
- Never use `Date.now()` alone as a credential serial or security token.

## Permissions

- `school_admin`: manage policies/templates/signatories and revoke credentials.
- Academic coordinator/authorized teacher: prepare or issue assigned student
  categories/classes within policy.
- HR-authorized staff: prepare employee certificates; salary/private HR data is
  never included by default.
- Approver: explicit capability scoped by definition/category.
- Student/parent/employee: request and access only their own published records.
- Public: minimal token verification only.

Definition changes, template publication, evidence overrides, approvals,
issuance, replacement, and revocation are audited.

## Privacy and security

- Certificates are commonly shared publicly: include only data necessary for
  the claim.
- No DOB, address, national ID, salary, guardian data, or internal notes by
  default.
- Hash bearer verification tokens at rest and rate-limit public endpoints.
- Protect signature/seal assets; watermark admin previews where appropriate.
- Validate template/font/image imports and reject active content/scripts.
- Generated bundles expire; individual issued PDFs follow retention policy.
- Evidence and revocation reasons remain internal unless a public reason is
  explicitly needed.
- PDF hash can detect whether a stored/downloaded artifact matches our generated
  file, but do not call it a cryptographic signature without real signing.

## Optional interoperable credentials (later phase)

Open Badges 3.0 is a strong future reference for portable achievement
credentials. It aligns with the W3C Verifiable Credentials model and defines
issuer, achievement, earner, proof, expiry, and verification metadata.

Recommended progression:

1. Version 1: SchoolOS-hosted certificate record + opaque QR verification.
2. Version 2: optional Open Badges-compatible achievement export/issuance for
   appropriate learning achievements.
3. Only later evaluate cryptographic VC signing/key custody and external wallet
   interoperability.

Do not add blockchain in version 1. A tenant-scoped database, strong audit,
opaque verification, immutable snapshots, and revocation solve the immediate
school use case with much less operational/key-management risk.

## Open-source/reference choices

See `REFERENCE-REPOSITORIES-AND-STANDARDS.md` beside this document.

- **pdfme**: primary visual template/PDF engine, shared internally with Card
  Management.
- **Open Badges 3.0**: primary future interoperability/credential metadata
  standard, not required for version 1 PDFs.
- **Blockcerts verifier ecosystem**: inspiration for transparent verification
  states and cryptographic verification UX; no blockchain dependency planned.
- **zedomel/certificate-generator**: inspiration for CSV/bulk placeholder and
  email-delivery flow only; not production architecture.

## Suggested implementation order

1. Implement addon activation/licensing enforcement.
2. Extract/prove neutral `document-studio` integration around pdfme with
   Arabic/French fonts and server-side generation.
3. Define certificate categories, policy versions, and real evidence adapters.
4. Add template/definition/signatory management.
5. Add request/approval and individual student issuance.
6. Add immutable serial/token/snapshot lifecycle and public verification.
7. Add bulk student jobs, retries, portal delivery, and exports.
8. Add employee issuance after or alongside HR employment-history foundations.
9. Add correction/replacement/revocation and reporting polish.
10. Evaluate Open Badges 3.0 as an optional later interoperability phase.

## Decisions to confirm before implementation

1. Which student certificate types does SchoolOS actually issue today, and what
   evidence/criteria authorizes each?
2. Are enrollment attestations legally/core-required documents that should
   remain core while advanced certificates are add-on?
3. Who may sign/approve each category, and is a four-eyes workflow required?
4. Which employee experience wording/data is legally acceptable in Morocco?
5. Which languages must each type support (French, Arabic, English)?
6. Do certificates expire, or only selected training/compliance credentials?
7. Should public verification show the full recipient name, masked name, or
   require serial + verification code?
8. Does version 1 need portal download only, or real email delivery too?

