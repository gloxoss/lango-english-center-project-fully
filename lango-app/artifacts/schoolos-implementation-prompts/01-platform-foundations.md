# 01 — Platform Foundations Prompt Pack

Use this pack with the master prompt, product context, design contract, and the relevant `future-implementation` specification. These pages precede feature add-ons because they define tenant safety, access, configuration, and operational visibility.

## Domain contract

- Roles: platform super-admin, tenant owner, school admin, scoped operator, auditor.
- Scope every query and mutation by tenant; branch scope is explicit where relevant.
- Secrets are encrypted, masked after save, never returned to the browser, and changed through rotate/replace actions.
- Every setting has schema validation, permission checks, change history, actor, timestamp, previous/new value redaction, and optimistic-concurrency protection.
- Add-ons require server-side entitlement checks. Navigation visibility is a convenience, not authorization.

## PF-01 — Migration readiness center

**Route:** `/dashboard/platform/migration-readiness`. **Objective:** let operators prove the legacy-to-current migration is safe before enabling new modules. **Mindset:** cautious, evidence-seeking. **Layout:** readiness score and blockers first; dependency graph, schema/backfill checks, tenant-isolation probes, deprecated-table usage, and rollback checklist below. **Actions:** run non-destructive audit, export evidence, acknowledge a reviewed warning; never run a destructive migration from this page. **Data/services:** migration registry, schema checks, feature flags, test evidence, audit log. **States:** never-run, running, passed, warning, blocked, stale evidence, job failure, forbidden. **Acceptance:** repeatable checks, no mutation of production records, downloadable signed run summary. **Exclude:** fake percentages and “one-click migrate” claims.

## PF-02 — Settings workspace

**Route:** `/dashboard/settings`. **Objective:** provide searchable configuration grouped into Organization, Academic Operations, Portals, Integrations, Security, Data, and Developer Operations. **Layout:** section rail, search, configuration health summary, unsaved-change bar, and contextual help. **Actions:** open section, compare inherited/effective values, save, discard. **States:** no permission, inherited read-only, validation failure, concurrent update, saved. **Acceptance:** deep links, keyboard navigation, RTL, dirty-form protection. **Exclude:** one enormous form and exposed credentials.

## PF-03 — Organization, branch, locale, and identity settings

**Routes:** `/dashboard/settings/organization`, `/branches`, `/locale`, `/numbering`, `/branding`. **Objective:** manage legal/display names, contact/address, branch hierarchy, timezone, week start, languages, MAD formatting, identifier sequences, and approved brand assets. **Layout:** focused forms with live effective-value preview; numbering includes collision simulation; branding includes print/web previews. **Data:** tenants, branches, locales, sequence policies, media assets. **Actions:** validate domain/phone/address, upload/replace assets, test next identifier. **States:** inherited value, invalid image, duplicate prefix, sequence locked after use. **Acceptance:** branch-safe overrides, atomic sequence allocation, accessible logos, no identifier reuse. **Exclude:** arbitrary HTML/CSS injection and false compliance badges.

## PF-04 — Academic operations and portal policy settings

**Routes:** `/dashboard/settings/academic`, `/portals`, `/attendance`. **Objective:** configure active academic year/term, weekends, attendance mode, grading defaults, student/parent login, directory privacy, default document templates, and role-specific feature availability. **Layout:** policy cards with impact summaries and affected-user counts. **Actions:** preview impact, schedule activation, revert where safe. **States:** missing dependency, effective later, partially rolled out, incompatible policy. **Acceptance:** changes are versioned and academic-period changes cannot silently rewrite history. **Exclude:** super-admin bypass as normal behavior.

## PF-05 — Users, roles, capabilities, and object scope

**Routes:** `/dashboard/access/users`, `/roles`, `/roles/[id]`, `/access-review`. **Objective:** invite/deactivate users, assign role bundles and branch/class/child scopes, and perform periodic access reviews. **Layout:** searchable directory; role detail permission matrix with human-readable consequences; review queue for excessive/stale access. **Actions:** invite, resend, suspend, revoke sessions, clone role, approve/reject access. **Data:** identities, memberships, capabilities, scope bindings, sessions. **States:** pending invite, active, locked, suspended, orphaned scope, last-admin warning. **Acceptance:** prevent removing the last tenant owner, audit every grant, object-level checks tested. **Exclude:** raw permission strings as the only explanation.

## PF-06 — Authentication, sessions, and 2FA

**Routes:** `/dashboard/security`, `/2fa/policies`, `/sessions`, `/login-log`. **Objective:** configure MFA policy, recovery, trusted devices, session duration, lockout, and risk review. **Layout:** posture summary, policy editor, active-session table, security event stream. **Actions:** require enrollment, revoke session, reset factors with dual confirmation, export events. **States:** enrollment required, recovery-only, suspicious login, locked account. **Acceptance:** step-up authentication for sensitive actions, hashed recovery codes, rate limits, privacy-safe IP/device display. **Exclude:** storing OTP secrets in logs or showing full tokens.

## PF-07 — Provider connections

**Routes:** `/dashboard/settings/connections`, `/connections/[provider]`. **Objective:** configure payments, SMTP/email, SMS, WhatsApp, live-class providers, storage, and optional analytics through a common adapter model. **Layout:** connection catalog with capability/status badges; detail page has credentials, webhook health, test console, rate limits, and event history. **Actions:** connect via OAuth where possible, save/rotate secret, test, disable, replay safe webhook. **States:** draft, connected, degraded, revoked, rate-limited, invalid webhook signature. **Acceptance:** secrets server-only, provider-specific validation isolated behind adapters, idempotent webhooks. **Exclude:** client-side provider secrets and “test succeeded” without a trace ID.

## PF-08 — Accounting links and defaults

**Route:** `/dashboard/settings/accounting-links`. **Objective:** map fee/payment/expense events to valid ledger accounts and branches. **Layout:** mapping table, unmapped-event queue, effective-date history, dry-run preview. **Actions:** map, validate, schedule, export exceptions. **States:** incomplete, invalid closed account, future-effective, conflict. **Acceptance:** mappings are versioned and posted history remains immutable. **Exclude:** editing ledger balances from settings.

## PF-09 — Translations and custom fields

**Routes:** `/dashboard/settings/translations`, `/custom-fields`, `/system-fields`. **Objective:** manage locale strings and safe tenant-defined fields without schema forks. **Layout:** locale coverage table and translation editor; custom-field builder with entity, type, validation, visibility, and reporting rules. **Actions:** import/export locale, preview RTL, publish translation version, add/reorder/archive fields. **States:** missing translation, placeholder mismatch, field in use, incompatible type change. **Acceptance:** preserve translation placeholders, sanitize rich text, archive rather than destroy used definitions. **Exclude:** arbitrary executable formulas.

## PF-10 — Scheduled jobs and operational audit

**Routes:** `/dashboard/settings/jobs`, `/jobs/[id]`, `/audit-log`, `/data-exports`. **Objective:** expose schedules, job runs, retries, failures, audit events, and privacy-controlled exports. **Layout:** health summary, filterable run/event tables, job detail timeline, export request detail. **Actions:** pause/resume permitted schedules, retry idempotent job, cancel queued work, request/approve/download export. **States:** queued, running, succeeded, partially failed, dead-lettered, expired download. **Acceptance:** correlation IDs, redaction, retention, two-person approval for sensitive bulk exports. **Exclude:** editable server cron expressions for ordinary admins.

## PF-11 — Add-on catalog and tenant entitlements

**Routes:** `/dashboard/add-ons`, `/add-ons/[key]`, super-admin `/dashboard/tenants/[id]/entitlements`. **Objective:** explain available modules, dependencies, plan/usage limits, activation state, and rollout health. **Layout:** catalog; detail with value, dependencies, permissions, data effects, usage, and enablement checklist. **Actions:** request trial, enable/disable with confirmation, assign limits, view usage. **States:** unavailable, trial, active, grace, suspended, dependency blocked. **Acceptance:** server-enforced entitlement and reversible navigation registration. **Exclude:** deleting module data when disabling an add-on.

## Verification prompt

Test cross-tenant denial, branch scope, last-owner protection, secret redaction, audit immutability, concurrent settings edits, provider webhook signatures, idempotent retries, Arabic RTL, keyboard navigation, mobile settings read-only fallbacks, and clean disabled-add-on behavior.
