# 10 — Public, Commercial, and Advanced Prompt Pack

These capabilities come after core data truth, permissions, and operational workflows. They must never weaken tenant isolation or imply regulatory certification.

## Public school website CMS

### PC-01 — Website setup, navigation, and publishing

**Routes:** `/dashboard/website`, `/website/settings`, `/navigation`, `/preview`. **Objective:** configure public school identity, locale/domain, header/footer/navigation, SEO defaults, consent analytics, and publish state. **Layout:** setup checklist, navigation tree, global preview, publish validation. **Actions:** edit, preview responsive/RTL, publish version, rollback. **States:** draft, validation errors, publishing, live, rollback available. **Acceptance:** route-scoped public CSS cannot leak into admin; CSP and sanitization. **Exclude:** arbitrary scripts and claiming enrollment/compliance metrics without evidence.

### PC-02 — Page and section editor

**Routes:** `/dashboard/website/pages`, `/pages/[id]`. **Objective:** compose Home, About, Admissions, Academics, Facilities, Gallery, News, and Contact from accessible approved sections. **Layout:** page tree, section canvas, property inspector, locale variants, SEO/social preview. **Actions:** add/reorder, schedule, preview, submit/publish. **States:** missing translation, broken asset, unpublished dependency, stale edit. **Acceptance:** versioning, keyboard reorder, image alt text, heading validation. **Exclude:** freeform code editor.

### PC-03 — Public forms and submissions

**Routes:** `/dashboard/website/forms`, `/submissions`; public `/contact`, `/request-demo`, `/admissions-interest`. **Objective:** collect minimal inquiries with consent and route them to CRM/admissions. **States:** spam quarantine, duplicate, routed, acknowledged, failed notification. **Acceptance:** rate limiting, CSRF/bot mitigation, retention, no direct student creation. **Exclude:** sensitive documents on generic forms.

## Custom domains

### PC-04 — Tenant domain connection

**Routes:** `/dashboard/domains`, `/domains/new`, `/domains/[id]`. **Objective:** guide a tenant through hostname entry, DNS records, verification, TLS provisioning, canonical redirect, and health. **Layout:** stepper with copyable DNS values and diagnostics. **Actions:** add, verify, set primary, redirect, remove after confirmation. **States:** pending DNS, verified, certificate provisioning, active, misconfigured, expired. **Acceptance:** ownership proof, host allowlist, no tenant takeover race. **Exclude:** asking users to paste private registrar passwords.

### PC-05 — Super-admin domain operations

**Route:** `/dashboard/platform/domains`. **Objective:** resolve conflicts, monitor TLS/renewal, and audit mappings across tenants. **Acceptance:** unique normalized host and safe suspension fallback. **Exclude:** browsing tenant content unnecessarily.

## Alumni

### PC-06 — Alumni administration and portal

**Routes:** admin `/dashboard/alumni`, `/alumni/[id]`, `/campaigns`; portal routes defined in role pack. **Objective:** verify graduates, manage opt-in profiles, opportunities/events, document requests, and consent. **Actions:** invite, verify, merge duplicate, segment with consent, export restricted list. **States:** invited, verified, hidden, bounced contact, consent withdrawn. **Acceptance:** alumni record links to historical student identity without exposing school-era private data. **Exclude:** public-by-default directory.

## Subscription and licensing

### PC-07 — Tenant subscription and usage

**Routes:** `/dashboard/subscription`, `/plans`, `/usage`, `/billing`. **Objective:** explain plan, add-ons, limits, measured usage, invoices, payment status, and upgrade/downgrade impact. **Layout:** current plan, usage meters with definitions, invoice history, change preview. **Actions:** update billing contact, request change, download invoice, manage payment method through provider. **States:** trial, active, grace, past due, suspended, cancelled. **Acceptance:** server entitlements derive from effective subscription; webhook idempotency. **Exclude:** storing full card details.

### PC-08 — Super-admin licensing operations

**Routes:** `/dashboard/platform/subscriptions`, `/licenses`, `/tenants/[id]/commercial`. **Objective:** manage plans, entitlements, trials, negotiated limits, dunning, and exceptions. **Actions:** create plan version, grant time-bound override, suspend/reactivate, inspect usage evidence. **States:** scheduled change, override expiring, payment dispute. **Acceptance:** dual confirmation/audit for manual grants; historical plan versions. **Exclude:** silently changing all existing contracts.

## Advanced differentiation

### PC-09 — Integration and API operations

**Routes:** `/dashboard/developer`, `/api-keys`, `/webhooks`, `/integrations`. **Objective:** issue scoped service credentials, register signed webhooks, inspect deliveries, and manage integration health. **Actions:** create/revoke key, rotate secret, replay safe delivery, download OpenAPI reference. **States:** active, expiring, revoked, delivery retry/dead-letter. **Acceptance:** least privilege, hashed keys, rate limits, secret shown once. **Exclude:** master tenant keys in browser storage.

### PC-10 — Offline synchronization center

**Routes:** `/dashboard/offline`, field-app sync status. **Objective:** expose offline-capable attendance/check-in/stocktake queues, conflicts, last sync, and device authorization. **Actions:** retry, resolve domain conflict, revoke device. **States:** pending, syncing, conflict, rejected, stale device. **Acceptance:** operation IDs/idempotency, minimal encrypted cache, clear merge policy. **Exclude:** generic last-write-wins for financial or official records.

### PC-11 — Product analytics and telemetry governance

**Routes:** `/dashboard/settings/telemetry`, platform `/product-analytics`. **Objective:** configure privacy-safe operational/product telemetry, retention, consent, and health alerts. **Layout:** event catalog, data classification, destination/status, sample redacted payload. **Acceptance:** no grades, messages, health, financial detail, or child PII in product analytics. **Exclude:** session replay on sensitive authenticated pages.

### PC-12 — AI-assisted review surfaces

**Routes:** contextual assistants for schedule suggestions, duplicate review, narrative drafts, and anomaly triage. **Objective:** provide optional suggestions grounded in visible evidence with human approval. **Layout:** suggestion, cited source facts, confidence/limitations, accept/edit/reject, feedback. **States:** unavailable, insufficient evidence, stale source, policy blocked. **Acceptance:** no autonomous admission, discipline, grade, payroll, or financial posting decisions; log model/version and human action where enabled. **Exclude:** chatbot-as-navigation and fabricated recommendations.

### PC-13 — Platform health and tenant support

**Routes:** `/dashboard/platform/health`, `/tenants/[id]/support`. **Objective:** show service/job/provider health and provide audited, time-limited support access. **Actions:** inspect redacted diagnostics, request/approve support session, revoke, export incident evidence. **States:** degraded, incident, maintenance, support active/expired. **Acceptance:** break-glass approval, banner to tenant where policy requires, no standing impersonation. **Exclude:** unrestricted super-admin browsing.

## Verification prompt

Test public/admin CSS isolation, CMS sanitization and version rollback, form abuse protection, domain ownership and collision, consent withdrawal, subscription webhook replay, entitlement effective dates, API-key leakage, offline conflict rules, telemetry redaction, AI human approval, and audited support access.
