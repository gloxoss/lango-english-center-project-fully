# Card & Admit Card Management — Future Addon

**Status: planned, not started.** This specification was produced from the
RamomSchool Card Management screenshots supplied on 2026-08-01, a direct audit
of SchoolOS, and open-source repository research. It defines the complete
logic needed for a useful product rather than copying five menu entries.

## Product decision

Build one paid **Card & Document Generation** addon supporting:

- Student identity cards
- Employee identity cards
- Exam/admit cards
- Reusable visual templates
- Individual and bulk generation
- Print-ready PDF sheets
- Secure QR verification, issuance, reprint, expiry, and revocation history

Certificates and report cards may reuse the generation engine later, but they
remain their own domains. This addon should not silently absorb every PDF in
the product.

## Reference screens and what they really imply

The supplied reference menu contains:

1. **ID Card Template**
2. **Student ID Card**
3. **Employee ID Card**
4. **Admit Card Template**
5. **Generate Admit Card**

The template list shows name, applicable user, page size/orientation,
background image, creation date, preview/edit/delete, search, export, and
print. Those screens reveal the navigation, but not the essential lifecycle:
template versioning, bulk-job failures, secure QR contents, issued-card status,
reprints, revocation, expiry, duplex alignment, exam eligibility, or audit
history. Those missing rules are specified below.

## Where SchoolOS is today (verified in the repository)

### Useful foundations already present

- Students and staff are real tenant-scoped `user` records.
- Students have matricules, class-section links, photos, status, and contact
  data; staff have employee IDs, photos, roles, branches, and employment fields.
- The app already has student photo management and a tenant logo upload/API.
- Branch records already contain name, code, address, phone, email, and city.
- Real academic structure includes session years, class sections, subjects,
  assessments, assessment sessions, schedule slots, rooms/buildings, and online
  exams.
- The app already scans QR/barcodes for attendance using the browser
  `BarcodeDetector`, with a manual fallback.
- `html2canvas` and `jspdf` are installed and an invoice print/PDF pattern
  exists.
- Audit logging and tenant-isolated API context already exist.
- A `certificates` table exists, although it belongs to an older/dead LMS chain
  and must not be treated as the foundation for this addon.

### What does not exist

- No card/admit-card template, issue, generation-job, or verification tables.
- No WYSIWYG document designer.
- No student/employee ID-card page.
- No template versioning or immutable issued-card snapshot.
- No secure QR token/verification endpoint.
- No print-sheet imposition, crop marks, bleed, or duplex alignment.
- No exam seat/room allocation model suitable for physical admit cards.
- Existing QR attendance scans do not mean identity-card QR issuance exists.
- `jspdf + html2canvas` can print a fixed component, but are not sufficient by
  themselves for a reliable editable template system and high-volume batches.

## Addon boundary

### Core remains available without this addon

- Student/staff profiles, photos, matricules, employee IDs, and access accounts.
- Academic assessment/exam scheduling.
- School logo/branch settings.
- Existing QR attendance workflow.
- Ordinary browser printing for invoices and core reports.

### Addon capabilities

- Template gallery and visual designer.
- Student and employee card issuance.
- Admit-card eligibility, generation, and delivery.
- Batch generation, print sheets, exports, and job history.
- QR verification and card lifecycle management.

When disabled, addon pages/APIs are blocked and hidden, but issued records and
templates are preserved. Already issued cards may continue to verify until
expiry/revocation unless the commercial policy explicitly says otherwise;
turning off an addon must not suddenly make physical cards appear fraudulent.

## Core concepts that must remain separate

### Template

A reusable design with dimensions, front/back pages, placed elements, field
bindings, allowed audience, and print settings.

### Issued document

A concrete student/employee/admit card generated from a particular published
template version and data snapshot. It has its own public verification token,
status, validity dates, and reprint history.

### Generation job

A batch request selecting many people/candidates. It records progress and
per-recipient errors rather than pretending the whole batch succeeded.

### Print batch

One or more issued documents imposed onto printable sheets. It is not the same
as issuance: the same issued card may be reprinted without creating a new
identity.

## Page architecture

### 1. Card Management Overview

Route: `/dashboard/cards`

- Counts: active templates, cards issued this session, cards expiring soon,
  revoked/lost cards, and failed generation jobs.
- Quick actions: create template, issue student cards, issue employee cards,
  generate admit cards, and open recent jobs.
- Warnings: missing photos/IDs, unpublished templates, expiring templates or
  cards, incomplete exam room allocations.
- Never show fabricated metrics when the addon has no data.

### 2. Template Library

Route: `/dashboard/cards/templates`

This replaces the reference's two disconnected template lists with one library
filterable by `student_id`, `employee_id`, or `admit_card`.

- Card/gallery and table views with thumbnail, name, type, orientation,
  dimensions, front/back, status, version, creator, updated date, and default
  badge.
- Actions: preview, duplicate, edit draft, publish new version, set default,
  archive, and export template JSON.
- Published/in-use versions cannot be mutated or hard-deleted.
- Starter gallery: clean student portrait, student landscape, staff portrait,
  minimal staff, standard exam pass, and compact exam pass.
- Import is allowed only through schema validation and safe asset handling;
  never execute scripts embedded in imported templates.

### 3. Template Designer

Route: `/dashboard/cards/templates/[id]/edit`

Use `pdfme`'s JSON-template/designer model as the preferred technical base,
wrapped in SchoolOS controls and styling.

#### Canvas and document settings

- Presets: CR80/ID-1 (`85.60 × 53.98 mm`), A6, A5, A4, and custom size.
- Portrait/landscape, front/back pages, safe zone, bleed, grid, rulers, zoom,
  snapping, alignment/distribution, undo/redo.
- Background color/image, optional watermark, corner-radius preview.
- Print settings: single-card page or multi-card A4 sheet, margins, gaps,
  crop marks, duplex flip edge, and back-side offset calibration.

#### Elements

- Static text, dynamic text, image/photo, school logo, line, rectangle, ellipse,
  SVG/icon, QR code, Code 128 barcode, and optional signature/stamp image.
- Element properties: position, size, rotation, layer order, lock, visibility,
  font, size, weight, color, alignment, border, background, padding, fit/crop.
- Dynamic fields are selected from an allowlisted field browser; do not allow
  arbitrary SQL, JavaScript, or expressions.

#### Data fields by type

**Student card:** full name, first/last name, matricule, class/level, branch,
session year, date of birth (optional), photo, validity dates, school/branch
contact, and verification QR.

**Employee card:** full name, employee ID, role, future HR designation and
department when the HR addon is active, branch, photo, hire date (optional),
validity dates, and verification QR.

**Admit card:** student name/photo/matricule, class, exam/session name, subject
schedule table, candidate number, room, seat, exam center, instructions,
validity, and verification QR.

Sensitive fields such as national ID, private address, salary, guardian phone,
or payment status are excluded from the default field browser. Adding any
sensitive field later requires a specific business/privacy decision.

#### Preview, validation, and publication

- Preview with a real tenant-scoped sample student/employee or safe fixture.
- Validate overflowing text, missing font/assets, out-of-bounds elements,
  insufficient QR quiet zone, low-resolution images, and missing required
  bindings.
- Draft autosave with explicit publish action.
- Publishing creates an immutable version; existing issued cards continue to
  reference their original version.

### 4. Student ID Cards

Route: `/dashboard/cards/students`

- Filter students by session year, branch, level/class section, status, photo
  availability, matricule availability, and current-card status.
- Select a template and validity period; preview one or multiple records.
- Eligibility defaults: active enrolled student, tenant match, matricule, and
  photo when the template requires one.
- Missing-data review groups problems by reason and links to the correct core
  page (student photo, matricule, or profile) instead of generating broken
  cards.
- Actions: issue new, download/print, reprint, replace lost/damaged, revoke, and
  view history.
- Bulk issue must be idempotent: retrying a job cannot accidentally create two
  simultaneously active cards for the same intended issuance.

### 5. Employee ID Cards

Route: `/dashboard/cards/employees`

- Filter by branch, application role, login status, employment status, and—if
  the HR addon is enabled—department and designation.
- Works with core staff records even when HR is absent; HR enriches the fields
  but is not a hard dependency.
- Do not issue a card automatically just because a user account exists.
- Allow employees without login accounts once the HR addon's proposed
  `employeeProfiles` model exists.
- Same issue/reprint/replace/revoke lifecycle as student cards.

### 6. Admit Card Templates

This is a filtered entry into the unified Template Library rather than a second
designer implementation:

Route: `/dashboard/cards/templates?type=admit_card`

- Admit templates can contain multi-row subject schedules and instructions,
  unlike small ID-card templates.
- Presets should favor A5/A4/half-page formats, not plastic-card dimensions.
- Require examination name/session and student identity fields before publish.

### 7. Generate Admit Cards

Route: `/dashboard/cards/admit-cards`

#### Selection flow

1. Choose academic session and physical exam event.
2. Choose class sections/cohorts or individual students.
3. Choose admit-card template.
4. Apply and review eligibility rules.
5. Review candidate numbers, room/seat allocations, and subject schedules.
6. Preview sample cards.
7. Generate, then download/print or publish to student/parent portals.

#### Required exam-domain gap

SchoolOS has assessments, sessions, rooms, schedule slots, and online exams, but
does not yet have a complete physical exam-event/candidate seating model.
Admit cards therefore need either new addon-owned tables or an agreed extension
to academics:

- `examEvents`: tenant, session year, name, start/end dates, center, status.
- `examEventSubjects`: exam event, class/subject, date, start/end, duration,
  room/building, instructions.
- `examCandidates`: exam event, student, candidate number, eligibility status,
  room, seat, accommodations/notes (restricted).

Do not generate meaningful admit cards from the unrelated legacy/dead LMS
course chain. Online exams without physical attendance do not need room/seat
admit cards unless the school explicitly chooses a simplified access pass.

#### Eligibility policy

Base rules:

- Student belongs to the tenant and selected class/session.
- Student and exam event are active/published.
- Student has a unique candidate number for that exam event.
- Required exam schedule and location data are complete.

Financial holds must **not** silently block an admit card. If a school wants
that policy, it must be explicitly configurable, legally reviewed, permission
restricted, and show a clear override/audit path. The default is no payment
gate.

### 8. Issued Cards & Verification History

Route: `/dashboard/cards/issued`

- Search/filter all issued documents by type, person, status, template version,
  issue/expiry date, and generation job.
- Statuses: `active`, `expired`, `revoked`, `replaced`.
- Events: issued, downloaded, printed, reprinted, replaced, revoked, and
  optionally verified (privacy-aware aggregation rather than unlimited raw
  tracking).
- Replacement revokes or marks the prior card replaced while preserving its
  history.

### 9. Generation Jobs

Route: `/dashboard/cards/jobs`

- States: queued, processing, partially completed, completed, failed, cancelled.
- Counts: requested, generated, skipped, failed.
- Per-record error CSV and retry-only-failed action.
- Generated output has a retention period; the immutable issue metadata remains
  after temporary PDFs are deleted.
- Large jobs run asynchronously; do not block one HTTP request while rendering
  hundreds of cards.

### 10. Public Verification Page

Route: `/verify/card/[token]`

- No login required, but rate-limited and abuse-monitored.
- Displays only minimum proof: school name/logo, card type, person's display
  name/photo only if policy permits, validity/status, and a generic valid/
  expired/revoked result.
- QR contains an opaque, high-entropy, revocable token or URL—not email,
  national ID, student database ID, or other raw PII.
- Invalid tokens return a generic result to reduce enumeration.
- Verification never grants portal access and is not authentication.

## Card lifecycle logic

1. **Draft template** can change freely.
2. **Published template version** is immutable and can issue cards.
3. **Issue** snapshots resolved printable data and references the version.
4. **Print/download** creates events but does not create new card identities.
5. **Reprint** increments reprint history using the same issue/token unless the
   physical card was lost or compromised.
6. **Replace** creates a new issue/token and marks the old one replaced/revoked.
7. **Expire** is derived from `validUntil` and/or maintained by a scheduled job.
8. **Revoke** immediately invalidates verification while retaining history.
9. **Archive template** prevents new issuance but never breaks past issues.

## Printing and output requirements

- Output PDF, individual PNG preview, and print-ready sheet PDF.
- Support A4 sheet imposition (for example 2×4 or configurable grid), exact
  millimeter sizing, margins/gutters, crop marks, and optional bleed.
- Duplex: front sheet in normal order; back sheet ordering/rotation depends on
  long-edge/short-edge flip. Provide a calibration test sheet and per-printer
  X/Y offset profile.
- Preserve vector text/QR where possible. Do not rasterize everything through
  `html2canvas` for final production output.
- Embed/subset approved fonts, including Arabic-capable fonts; test French,
  Arabic RTL, and long names.
- Batch ZIP may contain individual PDFs only when requested; default to one
  imposed PDF to avoid hundreds of downloads.

## QR and attendance integration

The app's existing attendance scanner can become a consumer of issued card QR
tokens, but the concerns stay separate:

- Verification token proves an issued card record exists and is active.
- Attendance API still checks tenant, person, class/register, date, duplicate
  marking, and the operator's permission.
- A public verifier must never mutate attendance.
- If offline scanning is required later, use a signed compact payload with key
  rotation and expiry; opaque online tokens are simpler and safer for version 1.

## Recommended data model

### `documentTemplates`

- `id`, `tenantId`, `name`, `type`
- `status` (`draft`, `published`, `archived`)
- `isDefault`, `createdById`, timestamps

### `documentTemplateVersions`

- `id`, `tenantId`, `templateId`, `version`
- `pageWidthMm`, `pageHeightMm`, `orientation`
- `schemaJson` (validated pdfme-compatible template)
- asset/font manifest, thumbnail reference, print settings
- `publishedById`, `publishedAt`
- unique `(templateId, version)`

### `issuedDocuments`

- `id`, `tenantId`, `type`, `templateVersionId`
- `subjectType` (`student`, `employee`, `exam_candidate`), `subjectId`
- `examCandidateId` when applicable
- `publicTokenHash` (store a hash, not the raw bearer token)
- `status`, `issuedAt`, `validFrom`, `validUntil`
- `issuedById`, `replacedDocumentId`, `revokedAt`, `revokedById`, reason
- `renderDataSnapshot` containing only the fields used on the document
- unique active-issuance constraints defined per type/session

### `documentGenerationJobs`

- `id`, `tenantId`, `type`, `templateVersionId`, filters/selection snapshot
- `status`, counts, requested/started/completed timestamps, creator
- output reference and expiry

### `documentGenerationItems`

- job, subject, issued-document reference, status, error code/message
- unique `(jobId, subjectType, subjectId)` for idempotent retries

### `documentEvents`

- issued document, actor, event type, timestamp, limited metadata

### Supporting exam tables

- `examEvents`, `examEventSubjects`, `examCandidates` as described above.

All tables are tenant-scoped. Every referenced student, employee, exam,
template, and actor must match the request tenant at both API and database
constraint/application-validation layers.

## Permissions

- `school_admin`: configure templates and policies; issue/revoke all types.
- Authorized admin/receptionist: issue/reprint student cards but not change
  templates or view sensitive HR fields.
- HR-authorized staff: employee-card operations when HR policies allow.
- Exam coordinator/authorized teacher: generate admit cards for assigned exam
  events/classes; no employee cards.
- Student/parent: download only their own published admit/student card when the
  school enables portal delivery.
- Public: verify opaque token only.

Template editing, bulk generation, revocation, and policy overrides are audited.

## Privacy and security requirements

- Minimize printed data; a card is easy to lose and cannot be access-controlled.
- No raw PII in QR/barcode payloads.
- Hash public bearer tokens at rest and use sufficient entropy.
- Rate-limit verification and generation APIs.
- Validate image/PDF/font/template uploads by size, MIME/header, schema, and
  allowed element types; strip or reject active content.
- Tenant-specific assets must never be fetchable by another tenant.
- Define retention for generated PDFs and print jobs.
- Mask sensitive values in logs and generation errors.
- Card verification does not prove the human holding it is the subject; it only
  proves the card record and displayed details.

## Failure and edge-case behavior

- Missing photo: skip only if template requires it; report exact correction
  link.
- Missing matricule/employee ID: block that item, not the whole batch.
- Duplicate candidate number: block exam publication/generation.
- Student changes class after issuance: historical card stays unchanged;
  authorized user decides whether to replace it.
- Template updated mid-job: job is pinned to the selected immutable version.
- Person deactivated: policy may revoke active cards automatically, but this
  must be explicit per type; employment/login deactivation and physical-card
  validity are not inherently identical.
- Generation crashes: retry uses job-item uniqueness and never duplicates
  successful issues.
- Addon/license disabled: block new management/generation, preserve verification
  and data according to the addon policy above.

## Open-source references selected

See `REFERENCE-REPOSITORIES.md` beside this file for verified links, licenses,
and usage boundaries.

### Primary: pdfme

Use as the preferred technical/reference base for the template designer and
generation engine. It is active, TypeScript/React, MIT-licensed, uses JSON
templates, works in browser and Node, and supports text, images, SVG, shapes,
custom fonts, QR, Code 128, PDF417, tables, and plugins.

We should integrate its packages/patterns behind our own tenant data binding,
RBAC, persistence, job system, and SchoolOS UI. Do not copy its full playground
or cloud service architecture.

### Secondary: LibreBadge

Use only for badge-domain workflow and printing inspiration. It is MIT-licensed
but archived (2025) and Django-based, so it is not an implementation dependency.

### Secondary: RedaElmar/ID-Cards-Generator

Use only for the simple dataset → bound template → barcode → batch PDF mental
model. It is MIT-licensed but a small Python/Jupyter/wkhtmltopdf project and is
not suitable as the production engine.

## Suggested implementation order

1. Implement subscription/addon activation enforcement.
2. Spike `pdfme` inside Next.js with one fixed student card and Arabic/French
   fonts; verify browser preview and server/batch output before schema work.
3. Add template/version/asset storage and safe data-binding allowlists.
4. Build Template Library and Designer.
5. Add issued-document/token/event lifecycle and public verifier.
6. Build student cards and production print sheets.
7. Build employee cards, integrating optional HR fields.
8. Add physical exam-event/candidate/seat model.
9. Build admit-card templates and generation.
10. Add asynchronous jobs, retries, retention, portal delivery, and QR
    attendance integration.

## Decisions to confirm before implementation

1. Should cards be valid per academic session, fixed date range, or both?
2. Which physical card printers/paper formats do the first schools use?
3. Is front/back duplex printing required in version 1?
4. Should public verification display the person's photo or only name/status?
5. Who may issue/revoke cards besides school admin?
6. Does the school need physical exam seating/rooms, or only an exam schedule
   pass?
7. Should full payroll/HR employment status automatically revoke employee cards,
   or require a confirmed offboarding action?

