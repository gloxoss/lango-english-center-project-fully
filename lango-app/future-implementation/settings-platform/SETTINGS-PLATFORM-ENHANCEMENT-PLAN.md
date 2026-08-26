# Settings Platform Enhancement — Complete Implementation Plan

Status: planned core-platform enhancement. Decisions are provisional pending owner review.

## Outcome

Replace the current collection of partially connected forms with a safe, searchable, dependency-aware Settings Center. Core settings remain available to every school; add-on settings appear only when their module is installed and ready. Configuration must be scoped, validated, versioned, auditable, recoverable and honest about whether a capability is actually active.

## Screen inventory

| # | Screen | Visible sections/actions |
|---|---|---|
| 1 | School Settings | General school/branch details, locale/timezone/weekends, unique roll policy, currency/format, registration prefix, offline payment, online exam, fee carry-forward, automatic logins, logos |
| 2 | Student / Parent Panel | Student/parent login, teacher contact visibility, default admit-card and marksheet templates |
| 3 | Live Class Settings | Zoom client credentials, per-user credential choices, OAuth redirect |
| 4 | Payment Settings | Many gateways, credentials/sandbox, multiple active gateways |
| 5 | SMS Settings | Active gateway, provider panels, SMS triggers |
| 6 | Email Settings | Sender, protocol/SMTP fields, security/auth, test email, triggers |
| 7 | Accounting Links | Default deposit and expense accounts, enable/disable |
| 8 | WhatsApp Settings | Widget copy/enabled states, support-agent roster and availability |
| 9 | Attendance Type | Attendance granularity/type selector |
| 10 | Settings navigation | School Settings, Translations, Cron Job, System Student Field, Custom Field, User Login Log |

## Feature map against current SchoolOS

### Keep — real foundations

- `schoolSettings` tenant row with establishment, contact, academic dates, presence modes, languages, security metadata, legal/CNDP fields.
- `tenants`, real branch model/management, logo endpoint, onboarding flow and academic `sessionYears`.
- Users/roles, staff management, access-reset workflows, audit logs and CNDP filing.
- Communication templates/log-only SMS, current Finance pages, and existing add-on registry/plans.

### Change — current behavior is incomplete or unsafe as configuration

- Split broad JSON blobs (`presenceModes`, `languages`, `security`) into typed/versioned policy documents or normalized models; unknown keys must not silently change behavior.
- The current Settings UI must load and save every displayed value, surface API errors and avoid demo defaults that can overwrite real data.
- `academicYear/startDate/endDate` must use authoritative `sessionYears`; eliminate competing sources of academic-period truth.
- Security toggles must control real implemented policies or show read-only readiness. A checkbox cannot claim 2FA, backup or strong-password enforcement when no enforcement exists.
- Provider credentials must never be displayed after save. The screenshots expose secrets in plaintext; SchoolOS must explicitly reject that pattern.
- Attendance configuration must replace the current Coming Soon page only after rules are modeled and used by attendance services.

### Add — platform capabilities

- Settings registry/schema, scope inheritance, effective-value resolver, versions/diffs, drafts, validation, approval, rollout, rollback and dependency graph.
- Secret references and rotation metadata; connection tests and health states.
- Settings search, readiness checklist, deep links, unsaved-change handling and per-section permissions.
- Localization overrides, safe scheduler operations, governed custom fields, login/security sessions and complete change history.

### Remove / do not copy

- Never copy plaintext credential display, free-form custom HTTP gateways, arbitrary cron expressions/code, password exports or multiple contradictory save buttons.
- Do not remove current CNDP, branches, users, audit, onboarding or access reset because they are absent from the reference’s internal tab list.

## Provisional decision gate

1. **Scope hierarchy:** platform defaults → tenant overrides → branch overrides only for keys declared branch-overridable.
2. **Change model:** ordinary low-risk settings save immediately with version history; secrets, authentication, finance mappings and destructive policy changes require test/confirmation and optional maker-checker approval.
3. **Add-on boundary:** each add-on registers its schema/UI/permissions/health checks; Settings Center composes them and never stores untyped vendor blobs.
4. **Extensibility:** custom fields are restricted to approved entities/field types in V1; no arbitrary formulas, scripts, SQL or runtime schema mutation.

## Information architecture

### Overview

- Search across setting labels/descriptions/keywords.
- Readiness cards: school profile, branches, academic year, identity/security, communication, payments, finance mapping, attendance, backups/compliance and enabled add-ons.
- Show configured/needs attention/degraded/not available, last changed by/time and test status.
- “Resume setup” links directly to the unresolved field, not a generic page.

### Core categories

1. Organization & branding
2. Branches & academic calendar
3. Localization & numbering
4. Users, portal & privacy
5. Security, sessions & compliance
6. Attendance policies
7. Communication providers & automations
8. Payments & finance mapping
9. Integrations/add-ons
10. Data model customization
11. Scheduler & system health
12. Audit, versions, import/export and recovery

The left navigation is generated from the settings registry and permissions. Add-on entries disappear or show `not installed` without breaking core settings.

## Core settings architecture

### Registry contract

Every setting definition declares:

- stable key, namespace/domain and schema version;
- value type/default/validation and allowed scope;
- sensitivity (`public`, `internal`, `personal`, `secret`);
- required permission and optional approval policy;
- dependencies/conflicts and impact description;
- effective-value strategy and cache invalidation topics;
- test/preview/apply/rollback hooks;
- owning module, readiness state and documentation link.

V1 definitions are code-owned and reviewed. The UI never invents keys from database JSON.

### Scope and inheritance

- Platform defaults are controlled by super admin/deployment.
- Tenant overrides apply school-wide.
- Branch overrides exist only for approved keys such as contact details, timezone, weekend/closure calendar, document prefix and provider routing.
- User preferences are separate (locale/theme/table density/notification preference) and cannot override security/business policies.
- Effective-value API returns value, source scope, inherited status, version and whether reset-to-parent is allowed.

### Lifecycle

- Draft → validate/test → optional approval → apply → verify health.
- Store immutable versions with redacted before/after diff, actor, reason, source IP/session, approval, validation result and impacted services.
- Rollback creates a new version; it never deletes history. Secret rollback uses a still-valid secret reference or requires re-entry.
- Optimistic concurrency prevents one admin overwriting another’s changes; show a three-way conflict diff.

## Page-by-page plan

### School Details / Organization

- Legal/trading name, tenant slug/domain reference, ICE/legal status, director, official email/phone, address, city/region/country and emergency contacts.
- Separate tenant identity from branch identity. Default branch may inherit but can override contact/location.
- Validate normalized phone/email/address; changing legal identity or tenant slug requires confirmation and dependency checks.
- CNDP remains its dedicated workflow and links back with real status; never render a hard-coded “valid” receipt.

### Branding and documents

- Logo variants: navigation, square icon, print, report card/document, light/dark; favicon and brand colors where supported.
- Validate MIME by content, dimensions, size, decompression safety and malware scanning; private originals, generated thumbnails and version history.
- Preview header, login, invoice, report card and ID/certificate consumers before apply.
- Each document/template module owns its template; organization settings choose defaults only from compatible published templates.

### Academic calendar and operations

- Use `sessionYears` as source of truth, with terms/semesters, branch closure/weekend calendars and explicit timezone.
- “Allow operations” becomes domain-specific period controls (attendance, grades, billing) with effective dates and status, not one ambiguous kill switch.
- Academic-year closing runs preflight checks and preserves historical references; never rewrite old records when default year changes.

### Locale, timezone, currency and formats

- Enabled portal locales, default locale, fallback locale, Arabic RTL preview, timezone and week start/weekend pattern.
- Base currency belongs to Office Accounting configuration; settings exposes its read-only effective value and formatting preview after ledger initialization.
- Currency/number/date formats are presentation preferences and cannot change stored accounting values.
- Timezone change runs impact preview for future schedules/jobs/events; historical instants remain unchanged.

### Registration, matricule and numbering

- Replace the screenshot’s register prefix controls with atomic versioned numbering-series configuration shared by admissions, invoices, receipts, vouchers, cards and certificates.
- Prefix tokens may use institution/branch/year; preview examples and collision scan are mandatory.
- Once issued, a series version is immutable. Changing format creates a future-effective version; counters use transactional locking.
- “Unique roll” is replaced by explicit matricule uniqueness scope (tenant/branch/academic year/class where valid) and migration preflight.

### Student / Parent portal

- Enable portal by role, invitation/provisioning policy, guardian household access, account recovery, optional automatic invitation and deactivation rules.
- Never auto-generate/export passwords. Generate accounts/invitations idempotently with one-time activation links.
- Privacy matrix controls teacher phone/email visibility, student directory visibility, household data, results, attendance, finance and documents; defaults are least disclosure.
- Default admit-card/marksheet/report templates are compatibility-filtered published versions with preview and fallback.
- Add portal health/readiness and impersonation only as a separately audited support capability if authorized.

### Identity, security and user sessions

- Password/authentication policy must align with Better Auth capabilities; 2FA status, methods, recovery, trusted device/session duration and admin enforcement.
- Session page: user, role, device/browser, approximate location, created/last active, revoked state; admins may revoke within permission.
- Login log: timestamp, result/reason category, user/account, role, IP prefix/redaction, user agent/device and risk signal; never store submitted passwords.
- Lockout/rate-limit policy, inactive-account rules and alerts. Security changes require reauthentication and may force session revocation.
- Backups are deployment/operations truth with last successful restore-test status—not a tenant checkbox pretending backups exist.

### Live Class settings

- Provider-neutral connection cards; BigBlueButton remains recommended first per the Live Class plan, with Zoom/Meet optional adapters.
- Store OAuth/API secrets in a secret store; display masked fingerprint, created/rotated/tested/expiry metadata only.
- Use supported server-to-server/OAuth models; never issue a separate provider credential to every student by default.
- Connection flow: create → callback/credential save → server test → capability discovery → activate. Allow one default plus ordered fallback only if reconciliation semantics are defined.
- Redirect/webhook URLs are generated read-only; webhooks require signature/replay verification.

### Payment settings

- Provider-neutral gateway registry showing only supported adapters for the tenant’s country/currency and installed modules; avoid the screenshot’s indiscriminate provider wall.
- Per connection: mode, merchant/account identity, secret reference, supported currencies/methods, fee/refund/webhook capabilities, health and activation scope.
- Multiple active gateways require explicit routing rule; duplicate callback/payment idempotency and reconciliation are mandatory.
- Test mode and live mode credentials are separated. Activation requires webhook verification and a sandbox/test transaction where available.
- Offline payment is not a global boolean: Student Accounting configures enabled methods, branch/cashier controls and receipts.

### SMS, email and communication settings

- Use `communicationConnections` from the Broadcast plan for SMS/email/WhatsApp; provider-specific fields come from adapter schemas.
- Email: verified sender/domain, reply-to, provider/SMTP host-port-security/auth, secret reference, TLS requirements, test send and delivery/bounce/complaint health.
- SMS: sender ID, country routing, encoding/cost preview, delivery receipt capability, rate limit and test send. Do not allow arbitrary custom GET/POST URLs in V1.
- Triggers become versioned communication automations with consent, audience, channel fallback, template, quiet hours, frequency caps and preview.
- Provider connections and campaign permissions are separate. Tests cannot send to arbitrary recipients without authorization.

### WhatsApp widget/support settings

- Separate public website widget presentation from WhatsApp Business provider connection and inbox routing.
- Widget: enabled, title/subtitle/footer, placement, allowed pages, locale variants, privacy notice and hours/offline behavior.
- Agents are references to active employees/users with team, queue skills, schedule/timezone and capacity; never duplicate photo/name/number into a loose settings table.
- Routing, conversation ownership, opt-in/template rules and delivery state belong to the WhatsApp/Broadcast module.

### Accounting links

- Integrates with Office Accounting chart of accounts. Configure typed module mappings (deposit, expense, receivable, revenue, tax, payroll, inventory), not arbitrary text/account labels.
- Only active compatible accounts are selectable. Validate dimensions/currency and run a posting simulation.
- Effective-dated mapping versions; existing vouchers retain the rule/version used. Invalid/missing mappings block posting into an exception queue.

### Attendance settings

- Register granularity: day/period/session; class/section applicability; required register coverage and teacher authorization.
- Status catalog/presence modes with semantic category and report impact; built-in meanings cannot be silently repurposed.
- Late thresholds/grace, early departure, excuse evidence/deadline/approval, correction/reopen workflow and absence alert rules.
- QR/scanner settings link to the QR enhancement plan; device/session controls stay there.
- Impact preview shows schedules/registers/reports affected. Rule versions are effective-dated so history remains reproducible.

### Finance-related school settings

- Fee carry-forward, due days, fines and reminders belong to Student Accounting policy pages, referenced from Settings Center—not duplicated toggles.
- Online exam behavior belongs to Assessment/Online Exam settings, including navigation mode, autosave, timing and accommodation policy; do not place one orphan toggle in general settings.
- Settings Center shows readiness/deep links and effective summaries for these domain-owned policies.

## Navigation-only pages from the reference

### Translations

- Manage tenant-specific overrides for approved UI/document/template keys per locale, with search, base text, override, context, preview, missing/invalid placeholders and import/export.
- Never allow translation content to inject HTML/scripts; rich content uses a sanitized format.
- Application-owned catalog remains in source control; tenant overrides are versioned data. Missing keys fall back predictably.

### Cron Job → Scheduled Jobs & Automations

- Rename to avoid promising arbitrary cron execution.
- Read-only catalog of registered jobs: owner module, purpose, schedule/timezone, last/next run, duration, success/failure, queue and health.
- Allowed controls: pause/resume approved jobs, run-now with permission/idempotency, inspect redacted history and retry safe failed runs.
- Schedules use validated presets/limited recurrence; no shell commands, code, SQL, URLs or unbounded frequencies.
- Global operational jobs remain deployment-controlled; tenant admins configure only declared tenant automations.

### System Student Fields

- Field catalog for built-in student properties: label/help, portal/form/report visibility, required-at-stage, edit roles, sensitivity and retention tag.
- Core identifiers, tenant linkage, security and legally required fields cannot be disabled or type-changed.
- Changes are stage/effective-date aware and run completeness previews before making a field required.

### Custom Fields

- Governed metadata fields on allowlisted entities (initially student, guardian, employee, inquiry) with key, localized label/help, type, options, validation, sensitivity, visibility/edit roles, required stage, order and active dates.
- Supported V1 types: short/long text, integer/decimal, date, boolean, single/multi option. No code, HTML, formula, relationship, file or external lookup initially.
- Values live in typed custom-value storage/indexes with tenant/entity/definition/version, not runtime DDL. Validate uniqueness/search indexing selectively.
- Archive definitions without deleting values; type migration requires preview/background conversion/error export and rollback.
- Custom fields automatically integrate with forms/reports/exports only when permissions and sensitivity allow.

### User Login Log

- Merge into Security → Login & Sessions rather than a disconnected raw table.
- Filters, risk/failure summaries, session drill-through, export masking, retention and CNDP access controls.
- Alerts for brute force/impossible behavior are advisory and explainable; do not auto-punish users solely on a heuristic.

## Existing pages retained and improved

- Branches: add inheritance summary, closure/timezone/contact/logo overrides, deactivate preflight, reassignment and dependency map.
- Users/Roles/Staff: move under Access; granular permissions, invitations, status/session/2FA indicators and bulk lifecycle actions.
- Access Reset: one-time activation/reset, expiry, revocation, delivery evidence and no password display.
- Audit Logs: include settings version/diff/test/approval/rollback events, richer filters and redacted metadata.
- CNDP: link settings to lawful purpose, retention, export/delete workflows and filing evidence.
- Onboarding: becomes a resumable guided view of the same settings APIs—never separate state.

## Data model

- `settingDefinitions`, `settingDefinitionVersions` (optional metadata cache; code registry authoritative in V1).
- `settingValues`: tenant, optional branch, key, schema version, non-secret value, version, effective dates and state.
- `settingValueVersions`: immutable redacted snapshot/diff, actor, reason, validation/test/approval/apply result.
- `settingDrafts`, `settingApprovals`, `settingDependencies`, `settingHealthChecks`.
- `secretReferences`: external/encrypted reference, provider, fingerprint, created/rotated/expires/tested; never secret plaintext in settings/audit/API responses.
- `integrationConnections`, `integrationConnectionEvents` for provider-neutral lifecycle/capabilities.
- `numberingSeriesDefinitions`, `numberingSeriesVersions`, atomic counters.
- `translationOverrides`, `customFieldDefinitions`, `customFieldDefinitionVersions`, `customFieldValues`.
- `scheduledJobDefinitions`, `scheduledJobControls`, `scheduledJobRuns`.
- `loginEvents`, `securitySessions` or mapped Better Auth session events with purpose-built retention.

Avoid one mega JSON settings row. Domain-owned configuration may use dedicated tables when relational constraints/effective dating matter; Settings Center still discovers it through registry adapters.

## API surface

- `GET /api/settings/catalog`, `/effective?scope=...`, `/search`, `/readiness`
- `GET|POST|PATCH /api/settings/values/:key`, `/validate`, `/test`, `/apply`, `/rollback`
- `/api/settings/drafts`, `/approvals`, `/versions`, `/health`
- `/api/settings/integrations`, `/:id/test|activate|rotate|disable`
- `/api/settings/translations`, `/custom-fields`, `/scheduled-jobs`, `/security/login-events|sessions`
- Domain adapters remain under `/api/settings/attendance`, `/api/.../settings` where ownership is clearer.

All writes use strict Zod discriminated schemas, permissions, reauthentication for sensitive changes, optimistic concurrency, idempotency, rate limits, audit events and redacted errors. Secrets are write-only. Bulk import uses validate → preview → commit jobs.

## Permissions and approvals

- `settings.read`, `settings.organization.manage`, `settings.branch.manage`, `settings.localization.manage`, `settings.security.manage`, `settings.integration.manage`, `settings.secret.rotate`, `settings.finance_mapping.manage|approve`, `settings.attendance.manage`, `settings.translation.manage`, `settings.custom_field.manage`, `settings.jobs.operate`, `settings.audit.read`, `settings.rollback`.
- A school admin is not automatically allowed to reveal/rotate secrets, change accounting mappings, reopen periods or weaken authentication.
- High-risk changes require recent reauthentication, reason and optionally a second approver. Creator cannot approve their own change when maker-checker is enabled.

## UX requirements

- Searchable responsive category navigation; breadcrumbs and deep-linkable sections.
- Section-level save with dirty indicator, validation summary and impact preview; no page-wide save for unrelated domains.
- Show current effective value, inherited source and “reset to inherited.”
- Mask secrets permanently; replace/rotate rather than edit. Copy is never available after submission.
- Clear provider health, last tested, capability and error remediation without leaking response bodies/credentials.
- Accessible keyboard/focus/errors, RTL, loading/error/empty/not-configured/degraded/permission/module-unavailable states.
- Mobile supports safe ordinary settings; secret entry, complex mappings and custom-field migrations may require desktop with an explicit explanation.

## Cache, runtime and failure behavior

- Effective settings resolver uses typed keys and bounded cache with version/etag; writes publish invalidation events.
- Services declare whether a setting is read per request, job start or document snapshot. Financial/academic documents record the policy version used.
- If settings storage is unavailable, security defaults fail closed, provider sends pause safely and core read paths use last-known-good only for explicitly safe keys.
- Circuit breakers prevent repeatedly failing connections/jobs. Health state is observable; never silently fall back to a different payment/communication provider without configured routing.

## Migration plan

1. Inventory every current `schoolSettings` field and actual reader/writer; classify real, dead, duplicated or misleading.
2. Fix the current UI’s full-load/full-error handling before schema migration.
3. Introduce registry/resolver and compatibility adapter over existing fields.
4. Migrate authoritative academic year to `sessionYears`; reconcile conflicts manually.
5. Migrate presence/language/security JSON to typed keys/policies with checksum comparison.
6. Move logo metadata/assets into branding versions without losing current logo.
7. Add settings versions/audit and verify effective-value parity per tenant/branch.
8. Migrate provider credentials only from secure existing sources; if plaintext exposure is possible, force rotation rather than copying.
9. Replace old reads gradually behind code-level feature flags; compare old/new decisions in shadow mode.
10. Remove compatibility fields only after zero reads and signed migration/recovery evidence.

## Delivery blueprint

| Phase | Deliverable |
|---|---|
| A | Settings inventory/ADR, registry, scope model, permissions, versioning and current-page correctness |
| B | New Settings Center shell, search/readiness, inheritance, drafts/diffs/rollback and health |
| C | Organization, branding, branches, academic calendar, locale/timezone and numbering |
| D | Portal/privacy, identity/security, login/session logs, CNDP and backup truth |
| E | Attendance policy and domain deep-link/settings adapters |
| F | Secret store integration, provider connections, email/SMS/WhatsApp/live-class health/test flows |
| G | Payment connections and Office/Student Accounting mappings with simulations/approvals |
| H | Translations, safe scheduled jobs, system/custom fields and migrations |
| I | Onboarding convergence, import/export, operations dashboards, performance and deprecation cleanup |

Execute A → B before expanding fields. Core categories C–E can then progress; provider work F–G depends on each add-on/domain adapter. Custom fields remain late because they multiply validation, privacy, forms and reporting complexity.

## Testing and acceptance

- Registry/schema tests guarantee defaults, scopes, permission, sensitivity and migration for every key.
- Tenant/branch inheritance, reset-to-parent, concurrent edit, effective dates, cache invalidation and rollback tests.
- Secrets never appear in GET responses, HTML, logs, audit metadata, errors, analytics, exports or browser persistence.
- Provider test/webhook spoof/replay, rotation, disable, degraded health and last-known-good behavior.
- Academic year/timezone/numbering/attendance policy changes preserve historical documents and do not collide.
- Custom-field validation, field/row permissions, archive/type migration, report/export masking and formula-injection protection.
- Accessibility, RTL, unsaved-navigation warning, API error rendering and all UI states.
- Disaster tests: settings DB/cache outage, bad rollout, lost secret, job flood, rollback, backup restore and cross-tenant isolation.

Definition of done: every visible control maps to an enforced typed policy or is a truthful read-only readiness link; no mock toggle, secret exposure, competing source of truth or unversioned risky change remains.

## Operational metrics

- Validation/test/apply failure rate, change-to-rollback rate, stale drafts/approvals and concurrent conflicts.
- Provider health/test latency, secret age/expiry, webhook failures and disabled/degraded connections.
- Effective-settings cache hit/staleness, invalidation lag and resolver errors.
- Scheduled job success/latency/backlog, custom-field migration failures and settings-related incidents.
- Readiness completion by category without exposing tenant content to platform analytics.

## Open-source references

- Infisical for secret lifecycle, rotation, audit and point-in-time recovery concepts: https://github.com/Infisical/infisical
- Unleash for typed feature-management, strategies, audit and safe rollout concepts: https://github.com/Unleash/unleash
- Flagsmith for feature flag/remote-config UX concepts: https://github.com/Flagsmith/flagsmith
- Frappe Framework for metadata/custom-field/version/workflow concepts: https://github.com/frappe/frappe
- JSON Schema concepts may inform provider schema rendering, but SchoolOS’s server authority remains strict Zod/domain validation.

Use these as architectural references. Review exact licenses, deployment cost and operational burden before adoption. V1 recommendation: build the typed Settings Center natively; use the deployment’s secret manager through a small adapter rather than embedding a full external admin product.

## Decisions to confirm later

1. Which settings may branch administrators override versus tenant administrators only?
2. Is external secret management required at launch, or encrypted database references backed by deployment KMS first?
3. Which live-class, payment, email, SMS and WhatsApp providers are launch priorities for Morocco?
4. Which high-risk changes require mandatory second-person approval for every tenant?

