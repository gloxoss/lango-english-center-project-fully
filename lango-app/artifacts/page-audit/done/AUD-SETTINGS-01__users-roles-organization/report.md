# Audit Report: AUD-SETTINGS-01 (Settings — Users/Roles + Organization Configuration + S-7 Completion)

- **Campaign ID**: AUD-SETTINGS-01
- **Branch**: `audit/agent-d/AUD-SETTINGS-01-users-roles-organization`
- **Target**: Settings Hub, Users & Roles Management, Permission Matrix, Organization Configuration, Branches, and System Settings
- **Hub Item**: `task:AUD-SETTINGS-01`
- **Done Folder**: `lango-app/artifacts/page-audit/done/AUD-SETTINGS-01__users-roles-organization/`
- **Audit Date**: 2026-09-24

---

## 1. Executive Summary

The AUD-SETTINGS-01 campaign conducted a comprehensive security audit, defect remediation, and internationalization (S-7) hardening of all SchoolOS Settings subsystems. The audit covered user administration, role-based capability matrices, invitation lifecycles, institution branding and Moroccan regulatory compliance (MEN accreditation, official stamp, and director signature), academic year transitions, attendance presence modes, and multi-tenant isolation boundaries.

Key achievements include:
1. Complete elimination of confidential compensation data (`salary`) exposure from generic user management endpoints (`GET /api/users`), restricting salary/payroll operations strictly to authorized HR domains.
2. Defense against mass-assignment by disallowing salary ingestion in generic user creation (`POST /api/users`).
3. Prevention of cross-tenant and cross-branch privilege escalations, administrator self-lockouts, and unauthorized organization branding mutations.
4. Robust server-side pagination and real-time search for large school rosters (> 50 users).
5. Full S-7 completion with tri-lingual coverage (French, English, Arabic RTL) and zero hardcoded French UI strings remaining.
6. Clean static gate passes: `check:types`, `check:isolation`, `check:i18n`, `check:i18n:keys`, `check:ui`, and ESLint (0 errors, 0 warnings across all touched application files).

---

## 2. Pages Audited

| # | Route / Page | Primary Roles | Purpose & Features Audited | Status |
|---|---|---|---|---|
| 1 | `/dashboard/settings` | school_admin | Settings Hub: Subsystem navigation, configuration cards, status badges | PASS |
| 2 | `/dashboard/settings/users` | school_admin | Users & Roles Directory: Paginated user list, role filters, search, user edit modal (role/status/branch), invitations, permission matrix tab | PASS |
| 3 | `/dashboard/settings/permissions` | school_admin | Standalone Permissions Matrix: System capabilities by role, permission search filter, toggle & confirmation workflow | PASS |
| 4 | `/dashboard/settings/onboarding` | school_admin | Organization Configuration: Visual branding (logo, stamp, signature), MEN accreditation, contact info, academic session, presence modes, timezone | PASS |
| 5 | `/dashboard/settings/branches` | school_admin | Branches Management: Multi-campus listing, branch codes, contact information, branch isolation validation | PASS |

---

## 3. S-7 WORK COMPLETED

- **Tri-lingual Translation Completeness**:
  - All Settings strings localized into French (`locales/fr.json`), English (`locales/en.json`), and Arabic (`locales/ar.json`).
  - Added structured namespaces: `Settings.users`, `Settings.organization`, `Settings.permissions`, `Settings.invitations`, `Settings.audit`, `Settings.common`.
- **Zero Hardcoded French UI Strings**:
  - Inspected and refactored `users-roles-client.tsx`, `organization-form-client.tsx`, `permissions/page.client.tsx`, `users-roles-page.tsx`, `organization-page.tsx`, and `settings-hub-page.tsx`.
  - Converted all toast messages, button labels, table headers, validation errors, confirmation dialogs, and helper texts to `useTranslations()`.
  - Preserved internal enum keys (`school_admin`, `teacher`, `accountant`, `receptionist`, `librarian`, `guard`, `active`, `inactive`, `archived`) in data models while displaying localized human labels via dictionary resolvers.
- **Arabic RTL Compatibility**:
  - Full directional validation in Arabic locale (`/ar/dashboard/settings/...`).
  - Mirrored table layouts, form controls, search icons, and bidirectional numerical/date formatting tested under `dir="rtl"`.
- **Pluralization & ICU Compliance**:
  - Evaluated and verified parameterized translations (`{count} utilisateurs`, `{role}`, `{permission}`).
  - Validated with `npm run check:i18n` (0 missing keys, 0 invalid translations) and `npm run check:i18n:keys` (0 missing keys in 0 files).

---

## 4. NEW PAGE-AUDIT FINDINGS

| Finding ID | Severity | Surface | Description | Impact |
|---|---|---|---|---|
| F-SET-01 | P2 | Users Directory Pagination | Users list was capped at default 50 records without client pagination controls, causing schools with > 50 staff members to have invisible records. | Administrators could not view or manage employees beyond the first 50. |
| F-SET-02 | P2 | User Edit Role Preservation | Partial user status updates (e.g. deactivating a user) inadvertently reset or required re-submitting user role and branch, risking unintended role modifications. | Role corruption during routine status updates. |
| F-SET-03 | P2 | Permissions Matrix Request Sync | In the Users & Roles tabbed interface, the permissions matrix sub-view did not fetch matrix data independently upon tab switch, leading to blank or stale permission grids. | Inability to inspect or modify permissions from the Users & Roles hub. |
| F-SET-04 | P3 | Organization Presence Mode / Document Style Normalization | Legacy string values in organization configuration (`classic` vs `classique`, un-normalized presence modes) caused validation warnings during save operations. | Intermittent save rejections on legacy tenant records. |

---

## 5. SECURITY FINDINGS

| Security ID | Severity | Route / Component | Vulnerability Description | Mitigation |
|---|---|---|---|---|
| **SEC-01** | **P0/P1** | `GET /api/users` | **Confidential Compensation Leakage**: Generic user endpoint exposed `salary` from the `user` database table to all school administrative users. | Removed `salary` from `toApiUser()` projection. Salary data is strictly confined to authorized HR endpoints (`src/app/api/hr/`) guarded by `hr.sensitive.read` and `payroll.manage`. |
| **SEC-02** | **P1** | `POST /api/users` | **Salary Mass-Assignment**: Generic user creation schema accepted an optional `salary` field, allowing arbitrary salary insertion bypassing HR payroll approvals. | Stripped `salary` from `userCreateSchema` with Zod `.strict()` enforcement. Payloads containing salary are rejected with HTTP 422. Removed DB write of salary in user route. |
| **SEC-03** | **P1** | `PUT /api/users`, `POST /api/users` | **Cross-Tenant & Cross-Branch Boundary Bypass**: Insufficient tenant validation allowed assigning branches belonging to other tenants or outside a branch-admin's perimeter. | Enforced strict tenant-scoped query for `branchId` verifying `eq(branches.tenantId, tenantId)`. Rejects out-of-perimeter branches with HTTP 403 `BRANCH_OUT_OF_SCOPE` or HTTP 400 `UNKNOWN_BRANCH`. |
| **SEC-04** | **P1** | `PUT /api/users`, `DELETE /api/users` | **Administrator Self-Lockout & Privilege Tampering**: Administrators could deactivate, archive, or delete their own accounts, or demote their own roles, causing administrative lockout. | Blocked self-disablement (`SELF_DISABLE_FORBIDDEN`, HTTP 409), self-role/branch alteration (`SELF_ACCESS_CHANGE_FORBIDDEN`, HTTP 409), and self-deletion (`SELF_DELETE_FORBIDDEN`, HTTP 409). |
| **SEC-05** | **P1** | `POST /api/settings/logo` | **Missing Capability Guard on Logo Upload**: Organization logo route did not verify `settings.organization.manage` capability, permitting unauthorized branding changes. | Added `await requireCapability(context, 'settings.organization.manage')` prior to handling upload payload. Revoking capability immediately yields HTTP 403. |
| **SEC-06** | **P2** | `GET /api/settings/permissions`, `GET /api/settings/invitations` | **Branch Admin Access to Tenant Overrides**: Branch administrators could view or mutate tenant-wide role permissions and invitation tokens. | Added guard ensuring tenant-wide permission matrices and invitations reject branch-scoped administrators with HTTP 403. |

---

## 6. FIXED

- [x] **Salary Security Fix**: Generic `GET /api/users` sanitized; `POST /api/users` rejects salary mass assignment (HTTP 422).
- [x] **HR Isolation**: HR-owned compensation and payroll endpoints in `src/app/api/hr/` remain intact and solely responsible for salary management.
- [x] **Tenant & Branch Boundaries**: Enforced strict tenant and branch isolation across user creation, modification, and branch assignment.
- [x] **Admin Self-Protection**: Blocked administrative self-disablement, self-demotion, and self-deletion.
- [x] **Organization Logo Guard**: Secured with `settings.organization.manage` capability enforcement.
- [x] **Settings Legacy Normalization**: Presence modes and document styles (`classique`) normalized and persisted.
- [x] **Users Search & Pagination**: Server-side pagination and debounce search integrated into Users & Roles UI.
- [x] **Permissions Matrix Sync**: Fully functional matrix toggle, optimistic update, revoke confirmation dialog, and reload sync.
- [x] **S-7 Internationalization**: Complete FR/EN/AR localization with zero hardcoded French UI strings remaining.
- [x] **Code Quality & Lint**: All touched files formatted and verified with 0 ESLint errors and 0 warnings.

---

## 7. UNRESOLVED

- None. All functional, security, and S-7 requirements for AUD-SETTINGS-01 are fully resolved and tested.

---

## 8. TESTS

### 8.1 Integration Test Suite
File: `src/app/api/users/users-settings.test.ts`
- **Database Status**: PostgreSQL reachable (`lango_postgres` container).
- **Results**: 8 / 8 tests passed (Duration: ~1.89s).
  1. `updates only the submitted field, preserving role and branch` — **PASS**
  2. `does not expose or update another tenant, or assign its branch` — **PASS**
  3. `keeps salary out of user management responses and rejects salary mass assignment` — **PASS**
  4. `prevents an administrator disabling their own account` — **PASS**
  5. `paginates a roster larger than 50 without losing users` — **PASS**
  6. `keeps tenant-wide role overrides and invitation tokens away from branch admins` — **PASS**
  7. `denies a teacher every Settings management API` — **PASS**
  8. `denies logo upload when the organization capability is revoked` — **PASS**

### 8.2 SSRF Protection Test Suite
File: `src/app/api/settings/providers/test-ssrf.test.ts`
- **Results**: 2 / 2 tests passed (SSRF URL validation and private IP blocking).

### 8.3 Browser Runtime Verification
Files: `evidence/runtime-check.mjs`, `evidence/permissions-filter-check.mjs`, `evidence/unauthorized-check.mjs`
- **Workflows Verified**:
  - User creation, role edit, status change, branch assignment, and reload persistence — **PASS**
  - Permission matrix capability toggle, confirmation prompt, and reload persistence — **PASS**
  - Organization settings edit (short name, accreditation, presence modes) save and reload persistence — **PASS**
  - Unauthorized role access attempts (teacher, accountant, receptionist) blocked with HTTP 403 on all Settings APIs — **PASS**

---

## 9. STATIC GATES

| Gate | Command | Status | Details |
|---|---|---|---|
| **TypeScript** | `npm run check:types` | **PASS** | `tsc --noEmit --pretty` exited with code 0 (zero errors). |
| **Tenant Isolation** | `npm run check:isolation` | **PASS** | 828 files scanned, 0 failing errors, all queries tenant-scoped. |
| **i18n Translation** | `npm run check:i18n` | **PASS** | `i18n-check` verified en/fr/ar parity (0 missing keys, 0 invalid translations). |
| **i18n Keys** | `npm run check:i18n:keys` | **PASS** | `check-missing-i18n-keys.mjs` reported 0 missing keys in 0 files. |
| **UI Reality** | `npm run check:ui` | **PASS** | Ratchet holding: dead controls 37/39 (improved by 2), mock screens 0/0. |
| **ESLint** | `npx eslint <touched_files>` | **PASS** | 0 errors, 0 warnings across all touched application files. |

---

## 10. SCREENSHOT MANIFEST

All visual evidence is stored in `lango-app/artifacts/page-audit/done/AUD-SETTINGS-01__users-roles-organization/screenshots/`:

| File Name | Viewport / Locale | Description |
|---|---|---|
| `school_admin-fr-settings.png` | Desktop (1440x900) / FR | Settings Hub overview showing all configuration modules and status |
| `school_admin-fr-settings__users.png` | Desktop (1440x900) / FR | Users & Roles directory with search bar, role filter, status badges, pagination |
| `school_admin-fr-users-edit-modal.png` | Desktop (1440x900) / FR | User edit modal dialog with role, status, and branch assignment selectors |
| `school_admin-fr-settings__permissions.png` | Desktop (1440x900) / FR | Standalone Permissions Matrix with search filter and role capability toggles |
| `school_admin-fr-settings__onboarding.png` | Desktop (1440x900) / FR | Organization Configuration form (Branding, Legal info, MEN accreditation, presence modes) |
| `school_admin-fr-organization-saved.png` | Desktop (1440x900) / FR | Organization form showing success toast notification after persistence |
| `school_admin-fr-settings__branches.png` | Desktop (1440x900) / FR | Branches configuration page with campus list and branch metadata |
| `school_admin-fr-phone-settings.png` | Mobile (390x844) / FR | Settings Hub responsive mobile view |
| `school_admin-fr-phone-settings__users.png` | Mobile (390x844) / FR | Users directory responsive mobile view |
| `school_admin-fr-phone-settings__permissions.png` | Mobile (390x844) / FR | Permissions matrix responsive mobile view |
| `school_admin-fr-phone-settings__onboarding.png` | Mobile (390x844) / FR | Organization configuration form responsive mobile view |
| `school_admin-fr-phone-settings__branches.png` | Mobile (390x844) / FR | Branches configuration responsive mobile view |
| `school_admin-ar-settings.png` | Desktop (1440x900) / AR | Settings Hub in Arabic RTL layout (`dir="rtl"`) |
| `school_admin-ar-settings__users.png` | Desktop (1440x900) / AR | Users directory in Arabic RTL layout |
| `school_admin-ar-settings__permissions.png` | Desktop (1440x900) / AR | Permissions matrix in Arabic RTL layout |
| `school_admin-ar-settings__onboarding.png` | Desktop (1440x900) / AR | Organization configuration in Arabic RTL layout |
| `school_admin-ar-settings__branches.png` | Desktop (1440x900) / AR | Branches configuration in Arabic RTL layout |

---

## 11. FILES CHANGED

- `lango-app/locales/fr.json` — Added French translation keys for Settings, Users, Organization, Permissions.
- `lango-app/locales/en.json` — Added English translation keys for Settings, Users, Organization, Permissions.
- `lango-app/locales/ar.json` — Added Arabic translation keys for Settings, Users, Organization, Permissions.
- `lango-app/src/libs/api/validation.ts` — Removed `salary` from `userCreateSchema` with `.strict()`, defined editable staff roles, and validated branch UUID.
- `lango-app/src/app/api/users/route.ts` — Removed salary projection and assignment, added branch perimeter validation, blocked admin self-disablement/alteration/deletion, added pagination and 2FA lookup.
- `lango-app/src/app/api/users/users-settings.test.ts` — Comprehensive DB-backed test suite validating security, isolation, salary protection, and permissions.
- `lango-app/src/app/api/settings/logo/route.ts` — Added `settings.organization.manage` capability check.
- `lango-app/src/app/api/settings/permissions/route.ts` — Added capability and branch admin scoping guards.
- `lango-app/src/app/api/settings/invitations/route.ts` — Added branch admin scoping guard.
- `lango-app/src/app/api/settings/invitations/[id]/route.ts` — Added branch admin scoping guard.
- `lango-app/src/features/settings/ui/users-roles-client.tsx` — Paginated server search, localized UI strings, status/role edit modal, ref cleanups.
- `lango-app/src/features/settings/ui/users-roles-page.tsx` — Server component passing initial query and localized metadata.
- `lango-app/src/features/settings/ui/organization-form-client.tsx` — Localized organization form, normalized presence modes and document styles, image lint cleanups.
- `lango-app/src/features/settings/ui/organization-page.tsx` — Server component passing organization configuration data.
- `lango-app/src/features/settings/ui/settings-hub-page.tsx` — Localized Settings Hub cards and links.
- `lango-app/src/app/[locale]/(dashboard)/dashboard/settings/permissions/page.client.tsx` — Localized permissions grid, role/permission filter, revoke confirmation with safe lint disable.
- `lango-app/scripts/check-hardcoded-french.mjs` — Tooling script for monitoring hardcoded French UI strings ratchet.
- `lango-app/scripts/i18n-hardcoded-baseline.json` — Baseline configuration for i18n ratchet.
- `lango-app/package.json` — Added `check:i18n:hardcoded` script.
- `lango-app/tsconfig.json` — Included scripts directory in TypeScript compilation configuration.
