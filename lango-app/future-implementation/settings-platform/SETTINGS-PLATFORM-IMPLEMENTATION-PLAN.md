# Settings-Platform Enhancement — Implementation Plan

> **Implementation status (2026-08-10):** Phases A–F are **implemented and live-verified**.
> - A — DB-backed definitions: `syncSettingDefinitions` (startup-seeded), catalog/search/readiness APIs.
> - B — Drafts & approvals: maker/checker state machine, SELF_APPROVAL guard, CAS apply.
> - C — Encrypted secrets: AES-256-GCM at rest for `sensitivity:'secret'`, peek/rotate APIs + UI.
> - D — Numbering + custom-fields registries (advisory-lock consume; wiring into forms = future work).
> - E — Scheduled jobs + allowlisted worker (`purge_sessions`/`noop` only), 60s poll.
> - F — Login-event capture (Better Auth after-hook) + legacy `schoolSettings` blob split (`LEGACY_SETTING_COLUMNS` + `getEffectiveValueWithLegacyFallback`).
>
> **Verification:** migration `0107` applied; fresh full `tsc --noEmit --incremental false` exit 0; settings vitest suite passes; live curl as seeded admin confirms POST→GET registry round-trip, legacy-fallback reads, and success/failure login capture; `check-tenant-isolation.ts` clean. **`next build` remains red on a pre-existing, unrelated subscriptions UI type error** (`subscription-overview-view.tsx:180`) — see tracker row #1 note.
>
> Source-of-truth tracker: `future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md` row #1.

## Context

`settings-platform` is the foundation every other module depends on (permissions, entitlements, providers, portals). The audit (tracker row #1) marked it **PARTIAL**: a working code-owned registry (~35 keys in `src/libs/settings/registry.ts`) with `settingValues`/`settingValueVersions` and a values page exists, but the plan's Phase A–I scope is largely absent. Per user decisions: implement **all Phase-1 audit gaps**, and make definitions **DB-backed**.

Outcome: a runtime-editable, DB-backed settings catalog with discovery APIs, a reviewed draft/approval workflow, encrypted secret storage, numbering/custom-field/scheduled-job registries, login-event capture, and full migration off the legacy `schoolSettings` JSON blobs.

**Non-negotiables (from `_shared/APP-CONTEXT-AND-UI-SYSTEM.md` + platform skill):** every route uses `requireRequestContext` → `requireTenant` → `requireCapability` → `parseJson(zod.strict())` → `recordAudit`; every query filters `tenantId`; hand-written migration (no `drizzle-kit generate`); French UI copy; single-file client pages; sidebar registration; secrets never logged.

**Key constraint:** Zod `valueSchema` is a function and cannot be serialized to DB. DB stores editable **metadata** (label, default, scope, sensitivity, group, requiredPermission, legacyField); the Zod validator stays **code-owned** in `SETTINGS_REGISTRY`. This is the pragmatic hybrid — runtime-editable catalog without losing type-safe validation.

## Existing assets to reuse

- `src/libs/settings/registry.ts` — `SETTINGS_REGISTRY` (defs), `getEffectiveValue`, `setSettingValue` (advisory lock + CAS + version rows), `getDefinition`, masks secrets.
- `src/libs/api/secrets.ts` — `encryptSecret`/`decryptSecret`/`isEncrypted` (AES-256-GCM, already used by broadcast).
- `src/app/api/settings/values/route.ts` + `values/[key]/route.ts` — per-key get/rollback + optimistic `expectedVersion`.
- `src/libs/api/{context,permissions,validation,audit,errors}.ts` — standard primitives.
- Payroll state machine (`src/features/workforce/services/payroll-runs.ts`) + certificate request enum — the drafts/approvals pattern (transition map + maker/checker).
- `src/instrumentation.ts` + `src/addons/advanced-reporting/services/schedule-worker.ts` — the setInterval worker pattern for the scheduled-jobs worker.
- Accounting numbering (`src/features/accounting/services/posting-service.ts:226`) — FOR UPDATE + advisory-lock numbering pattern for the numbering registry.
- `src/libs/auth.ts` hooks (`before`/`after` createAuthMiddleware) + `src/libs/auth/lockout.ts` (`trackEmailPasswordResult`) — where login capture hooks in.

## Migration (`migrations/0107_settings_platform_enhancement.sql`)

Hand-written, `CREATE TABLE IF NOT EXISTS`, enums via `DO $$ BEGIN CREATE TYPE … EXCEPTION WHEN duplicate_object THEN null; END $$;`. Add ONE journal entry (idx **108**, tag `0107_settings_platform_enhancement`, `when` > previous). New tables, all in a new barrel `src/features/settings/models/settings-schema.ts`:

1. `settingDefinitions` (+ `settingDefinitionVersions`) — DB catalog; metadata from code, editable at runtime.
2. `settingDrafts` + `settingApprovals` — review workflow.
3. `secretReferences` — cipher/rotation audit for secret keys.
4. `numberingSeriesDefinitions` (+ `numberingSeriesVersions`).
5. `customFieldDefinitions` (+ `customFieldDefinitionVersions`) + `customFieldValues`.
6. `scheduledJobDefinitions` + `scheduledJobControls` + `scheduledJobRuns`.
7. `loginEvents`.

All tables `tenant_id` text NOT NULL + uuid PK + timestamps (match `settingValues` shape). Barrel line added to `src/models/Schema.ts` end block.

---

## Phase A — DB-backed definitions + discovery API

- `definitions-service.ts`: `syncSettingDefinitions(db)` upserts every `SETTINGS_REGISTRY` entry (idempotent; bumps `settingDefinitionVersions` on metadata change); `getDefinition(key)` resolves metadata from DB with code fallback (fail-open on DB error so nothing breaks); in-memory cache invalidated on write.
- Seed: `scripts/seed-setting-definitions.ts` (idempotent) + run `syncSettingDefinitions` from `src/instrumentation.ts` at startup.
- APIs: `GET /api/settings/catalog` (all defs grouped by namespace, from DB), `GET /api/settings/search?q=` (defs + current values), `GET /api/settings/readiness` (per-namespace: overridden/default/secret-set/integration-connected counts → module status list, powers the hub).
- UI: values page shows catalog metadata; hub reads readiness instead of ad-hoc per-module queries.
- Verify: seed script idempotent ×2; catalog/search/readiness return real rows; tsc clean.

## Phase B — Drafts & approvals

- `drafts-service.ts`: state machine `draft→submitted→(approved|rejected)→applied` + `draft→cancelled`, payroll-style `ALLOWED_TRANSITIONS` + maker/checker (approver ≠ author, `403 SELF_APPROVAL`). Apply calls `setSettingValue(…, expectedVersion=baseVersion)`; inserts `settingApprovals` row per decision; audits.
- APIs: `GET /api/settings/drafts?status=`, `POST /api/settings/drafts`, `PATCH /api/settings/drafts/[id]` (edit/submit/cancel), `POST /api/settings/drafts/[id]/approve`, `POST /api/settings/drafts/[id]/reject`.
- Permission `settings.approve` (school_admin/super_admin via ALL_PERMISSIONS).
- UI: `/dashboard/settings/drafts` page (inbox + history + approve/reject dialogs).
- Verify: vitest on transitions + self-approval guard; live two-admin flow (create→submit→approve→value applied).

## Phase C — Encrypted secrets

- Hook into `setSettingValue`: when `def.sensitivity === 'secret'`, store `encryptSecret(JSON.stringify(value))`; `getEffectiveValue` returns `'********'` (masked, unchanged). Add `isEncrypted`-aware read: legacy plaintext secret values still resolve (documented migration path — encrypted on next write).
- `secretReferences` append-only rows per rotation (key, cipher, rotatedAt, rotatedBy, valueId).
- API: `POST /api/settings/values/[key]/rotate` (re-encrypt new IV) gated by `settings.secret.rotate`; `POST /api/settings/values/[key]/peek` gated by the key's `requiredPermission` + `settings.secret.rotate`, writes audit `settings_change`.
- UI: values page — secret fields write as encrypted; explicit "reveal" action with access audit.
- Verify: encrypt→store→mask; decrypt round-trip test; rotate changes blob; live curl.

## Phase D — Numbering series + custom fields

- `numbering-service.ts`: CRUD over `numberingSeriesDefinitions` (key/prefix/suffix/padding/start/current, FOR UPDATE + advisory lock on `next`), `[id]/preview` computes next value without consuming. Version history rows.
- `custom-fields-service.ts`: CRUD definitions (`entityType: student|guardian|employee`, `fieldType: text|number|date|select|boolean`, options/required/default/sort); `customFieldValues` get/set per `(definitionId, entityId)`; unique constraint.
- APIs: `/api/settings/numbering` (+`/[id]`, `/[id]/preview`), `/api/settings/custom-fields` (+`/[id]`, `/[id]/values`).
- Permissions: `settings.custom_field.manage` (add `settings.numbering.manage` if not present).
- UI: `/dashboard/settings/numbering`, `/dashboard/settings/custom-fields` pages.
- **Explicit boundary:** these establish the registries; wiring them into student/guardian/invoice forms is out of scope (future work, noted in tracker).
- Verify: numbering preview/consume never duplicates under concurrency (test); custom-field CRUD + values round-trip.

## Phase E — Scheduled jobs

- `scheduled-jobs-service.ts`: DB-backed definitions (key/name/intervalMinutes|schedule/handler/isActive/last+next run); `scheduledJobControls` audit rows; `scheduledJobRuns` outcome rows.
- **Handler allowlist (no arbitrary code):** `purge_sessions` (exists in `settings/jobs/[id]/trigger`) + a `noop` smoke handler. Anything else rejected.
- Worker `settings-worker.ts` (setInterval poll, started-guard, like schedule-worker) wired in `src/instrumentation.ts`; runs due jobs, records runs, recomputes `nextRunAt`; manual trigger endpoint.
- APIs: `/api/settings/scheduled-jobs` (+`/[id]`, `/[id]/trigger`, `/[id]/toggle`). Permission `settings.jobs.operate`.
- UI: `/dashboard/settings/scheduled-jobs` page (list, enable/disable, run-now, run history).
- Verify: worker fires a due job autonomously (purge_sessions runs, row recorded); toggles respected; tsc clean.

## Phase F — Login events + legacy-blob split

- `loginEvents` capture in `src/libs/auth.ts`/`src/libs/auth/lockout.ts`: record success + failure email/password sign-ins (tenantId, userId, email, method, success, ip, userAgent). API `GET /api/settings/security/login-events` (paginated/filtered). UI `/dashboard/settings/security` login-log view.
- Registry: add `security.loginAccessMethod` key. Update the 3 direct `schoolSettings.loginAccessMethod` readers — `src/libs/services/alumni-transition.ts`, `src/app/api/students/[id]/regenerate-access/route.ts`, `src/app/api/students/admissions/route.ts` — to `getEffectiveValue(…, 'security.loginAccessMethod')` with legacy-column fallback.
- Attendance QR route (`src/app/api/attendance/qr/verify-and-stage/route.ts:178`) reads `attendance.lateGraceMinutes`, `attendance.periodStartTime`, timezone via registry with legacy fallback.
- Organization page (`src/features/settings/ui/organization-page.tsx`) + `src/app/api/settings/route.ts`: read via registry; keep POST dual-write (safe); stop round-tripping `presenceModes/languages/security` JSON blobs as the source of truth.
- Verify: failed + successful login appear in events; QR flow still marks late/present correctly (regression live test); org page saves to registry.

## Cross-cutting

- `src/libs/api/permissions.ts`: add `settings.approve`, `settings.secret.rotate`, `settings.rollback`, `settings.custom_field.manage`, `settings.numbering.manage`, `settings.jobs.operate`, `settings.translation.manage`, `settings.finance_mapping.manage`. Register in `DEFAULT_ROLE_PERMISSIONS` only where a non-admin role needs it (none today).
- Sidebar + `settings-hub-config.ts`: add entries Drafts, Numbering, Custom fields, Scheduled jobs, Login log.
- New vitest under `src/features/settings/__tests__/`: definitions-sync, drafts transitions + self-approval, secrets round-trip + rotation, numbering concurrency, login-event capture.
- Doc sync: after approval save a copy `future-implementation/settings-platform/SETTINGS-PLATFORM-IMPLEMENTATION-PLAN.md`, update `_tracker/PLANS-AUDIT-AND-PROGRESS.md` row #1 as work proceeds.

## Execution order & verification gate per phase

Order A→B→C→D→E→F (each phase keeps the app green):

1. `docker compose build migrate && docker compose up migrate` (real exit code) for 0107.
2. `npx tsc --noEmit` exit 0.
3. `npx vitest run src/features/settings/` all pass.
4. Live curl as seeded admin (`y.elamrani@atlas.ma` / `Admin123!`) against the running app.
5. `npx tsx scripts/check-tenant-isolation.ts` — no NEW flags for the settings scope (record current baseline first).
6. `npx next build` exit 0 (after #16 payroll-runs fix if still failing — check `git status`; if it's a pre-existing unrelated error, note it and rely on tsc + vitest + live curl).
