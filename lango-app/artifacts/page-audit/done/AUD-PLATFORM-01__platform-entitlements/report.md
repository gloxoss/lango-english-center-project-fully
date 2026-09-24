# AUD-PLATFORM-01 — Super Admin + Tenant Lifecycle + Entitlements — Executor Report

## 1. Handoff Metadata

- Executor: codex-2 (Executor C)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-c/AUD-PLATFORM-01-platform-entitlements`
- Implementation SHA(s): see §13
- Hub item: `task:AUD-PLATFORM-01` (+ `task:port-3462`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-PLATFORM-01__platform-entitlements/`
- Collision check before claim: **clean** (antigravity-1 held AUD-FINANCE-01 only)

## 2. Scope

Platform-management layer only. Route inventory discovered from the filesystem
and guards, not assumed. **12 pages + 26 super-admin API routes.**

### Pages audited

| # | Route | Role | Purpose | Result |
|---|---|---|---|---|
| 1 | `/dashboard/super-admin` | super_admin | Platform hub + summary | PASS (denied to school_admin) |
| 2 | `/dashboard/super-admin/schools` | super_admin | Tenant / institution directory | PASS (denied) |
| 3 | `/dashboard/super-admin/schools/create` | super_admin | Tenant creation & provisioning | PASS (denied) |
| 4 | `/dashboard/super-admin/schools/[id]` | super_admin | Tenant detail | PASS (denied) |
| 5 | `/dashboard/super-admin/domains` | super_admin | Domain bindings | PASS (denied) |
| 6 | `/dashboard/super-admin/subscriptions` | super_admin | Plans, licences, add-ons | **FIXED (F-01)** (denied) |
| 7 | `/dashboard/super-admin/subscriptions/list` | super_admin | Subscription list | **FIXED (F-01)** (denied) |
| 8 | `/dashboard/super-admin/settings` | super_admin | Plan limits, add-on definitions | PASS (denied) |
| 9 | `/dashboard/super-admin/waitlist` | super_admin | Waitlist → convert | PASS (denied) |
| 10 | `/dashboard/super-admin/reports` | super_admin | Platform reports | PASS (denied) |
| 11 | `/dashboard/super-admin/support` | super_admin | Platform support desk | PASS (denied) |
| 12 | `/dashboard/super-admin/sms` | super_admin | Platform SMS | PASS (denied) |

### API surface audited
`addon-definitions`, `alerts`, `domains`, `domains/[id]`, `entitlements`, `health`,
`plan-limits`, `reports`, `schools`, `schools/[id]`, `schools/[id]/branches`,
`schools/anonymize`, `schools/backup`, `sms`, `subscriptions`,
`subscriptions/[schoolId]`, `subscriptions/[schoolId]/license`,
`subscriptions/[schoolId]/payments/[paymentId]/decision`, `summary`, `support`,
`waitlist`, `waitlist/convert`, plus `api/platform/{edge-tenant-resolve,caddy-ask}`
(tenant routing) and the cross-cutting `libs/api/{entitlements,addon-catalog}.ts`.

### Explicitly out of scope
School-level Settings, HR, Finance, Admissions, Academics, Attendance and Support
were **not** modified (frozen). No platform integration produced a contradiction
in them, so there are no cross-module findings this campaign.

## 3. Workflow Understanding

`create tenant → provision organization → assign plan/add-ons → activate →
enforce entitlement → suspend / reactivate → tenant data preserved`

- **Tenant creation/provisioning** (`schools`, `schools/create`, `schools/[id]`).
- **Plans & licences**: `subscriptions/[schoolId]/license` with `action: issue`
  (requires `months` or `expiresAt`), and
  `subscriptions/[schoolId]/payments/[paymentId]/decision` for payment approval.
- **Add-on catalogue & entitlements**: `addon_definitions` (seeded from
  `@/addons/registry`, with a static fallback so the catalog is never empty) and
  `addon_entitlements` per tenant.
- **Enforcement** happens at one choke point: `requireAddon()` → `hasAddon()` →
  `isActive()`, called by every add-on route in the platform.
- **Suspension** is a background sweep (`runLicenseExpirySweep`) that suspends a
  tenant whose active licence has passed `expiresAt` with no paid renewal.

**Source of truth:** `school_licenses.status` + `expiresAt` for the paid period;
`addon_entitlements` for module access; `addon_definitions.requires` for the
dependency graph; `tenants.isActive` plus the billing check in
`libs/api/context.ts` for tenant-level access.

## 4. Findings

| ID | Severity | Surface | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| **F-01** | **High** | `entitlements.isActive` + `runLicenseExpirySweep` | Entitlement/licence expiry cut off ~23 hours early and the two paths disagreed on how to compute it. | See below | **FIXED** |

### F-01 in detail
`expiresAt` is submitted by the entitlement and licence screens as a **date-only**
string (`z.iso.date()`), so it names a **day the customer paid through**. But:

- `isActive` did `new Date(expiresAt).getTime() > Date.now()`.
  `new Date('2026-12-31')` is **UTC midnight**, so a module switched off at
  **00:00 on the last paid day**. A school paying through 31 Dec lost the add-on
  for ~23 hours it had paid for.
- `runLicenseExpirySweep` compared `lt(expires_at, new Date().toISOString())`
  against a naive `timestamp` column — a second, differently-derived definition
  of "expired". On a non-UTC host the gate and the suspension worker could
  disagree, suspending a tenant whose modules still worked (or the reverse).

**Fix:** one shared rule, `isExpiredAt()`, used by **both** paths:
- a **date-only** value expires at the **end of that Casablanca business day**
  (`casablancaTodayIso() > expiresAt`);
- a value **carrying a time** is an exact instant and is honoured to the second
  (this matters: the existing worker tests expire a licence 1 second ago).

The worker now scans candidates broadly and decides with `isExpiredAt`, so
suspension and `requireAddon` can never drift apart.

## 5. Verified strong (checked before forming an opinion)

- **Privilege escalation / super-admin-only ops:** `schools/anonymize` requires
  `requireRequestContext(['super_admin'])` **and** `requireSuperAdmin`, and writes
  `recordAudit(…, 'update', 'tenant_anonymize', schoolId)`. Same pattern on the
  other destructive platform routes.
- **Cross-tenant IDOR:** platform routes resolve the tenant from the request
  context, never from the body. `check:isolation` confirms no `tenantId` is bound
  from client input anywhere (828 files).
- **Tenant status enforcement:** `libs/api/context.ts` blocks a suspended or
  cancelled tenant at a **single choke point**, explicitly "the same single choke
  point as `isActive`". F-01 keeps those two in agreement.
- **Stale entitlements:** `isActive` returns false for a disabled **or** expired
  row; `requireAddon` denies identically for missing/disabled/expired, so callers
  learn "not activated" and never which of the three (no enumeration oracle).
- **Add-on removal / dependency:** `assertAddonDependencies` enforces dependencies
  at activation **and** blocks a deactivation that would strand a dependent
  add-on (`ADDON_DEPENDENCY_ACTIVE`). `requireWorkforceAddon` enforces the hard
  `payroll-workforce → human-resources` dependency.
- **Irreversible deletes:** anonymize is audited and super_admin-only; no route
  performs a hard tenant delete.
- **Secrets / PII exposure:** gateway secrets live behind `getConnectionWithSecrets`
  and are not returned to clients; platform routes expose aggregates.
- **Audit trail:** destructive and state-changing platform routes call `recordAudit`.

## 6. Security / Isolation / Permission Audit

- **Tenant isolation:** `npm run check:isolation` **PASS** (828 files).
- **Page guard:** all 12 pages call `requireServerPage`; every one denies
  school_admin on direct URL (captured) — honest gating.
- **API guard:** `requireRequestContext(['super_admin'])` + `requireSuperAdmin`
  on platform-admin routes; `requireAddon` on add-on routes.
- **IDOR / object ownership:** licence, entitlement, domain and payment-decision
  lookups are tenant/school scoped.
- **Request validation:** Zod `.strict()` bodies (`z.iso.date()` for expiry).
- **Sensitive-data exposure:** platform-only aggregates; no PII leaked to tenants.
- **Audit logging:** `recordAudit` on state-changing routes.

## 7. Data / DB / Migration Impact

- **Tables read:** `tenants`, `school_licenses`, `license_payments`,
  `addon_entitlements`, `addon_definitions`, `tenant_invitations`, `domains`,
  `plan_limits`, `audit_logs`.
- **Tables written:** none by the fix (read-side rule only).
- **Historical data changed:** **none.**
- **Migration added:** none. **Journal status:** untouched.

## 8. Tests

### Focused tests
```text
npx vitest run src/features/subscriptions src/libs/api  ->  137/137 PASS (15 files)
  entitlement-expiry.test.ts (NEW, 7):
    - active through the whole of its expiry day
    - inactive once the expiry day has passed
    - active before its expiry day
    - a disabled row is never active, whatever the date
    - a null expiry is open-ended
    - a full timestamp is honoured as an exact instant
    - the suspension worker shares the rule with the gate
  pre-existing (all still green), notably:
    license-expiry-worker.test.ts   (suspend + audit row + no re-suspend)
    entitlements.test.ts            (6)
    subscription-enforcement.test.ts, platform-billing-service.test.ts
    permissions.test.ts, page-guard.test.ts, nav-page-guard-parity.test.ts
```

### Iterations that mattered (honest record)
1. First attempt compared business dates for **every** expiry. That fixed the
   date-only case but broke `license-expiry-worker.test.ts`, which expires a
   licence **1 second** ago — an exact instant. The test was right.
2. Second attempt left the two paths disagreeing and broke my own assertions.
3. Final design: a **hybrid** rule (`isExpiredAt`) — date-only ⇒ inclusive of its
   Casablanca day, time-bearing ⇒ exact instant — shared by the gate and the
   worker. 137/137, including the two originally-failing licence tests.

### Static gates
```text
check:types      PASS   (tsc --noEmit, 0 errors)
check:isolation  PASS   (828 files scanned)
check:i18n       PASS   (missing translation keys: 0 in 0 files)
check:ui         PASS   (ratchet holding)
eslint touched   PASS   (0 problems on all three touched files)
```

## 9. Visual / UX Evidence

### Screenshot manifest
| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/school_admin-fr-*.png` (12) | every super-admin route as school_admin | FR | Desktop 1440x900 | Each platform page denies non-super-admins honestly |
| `screenshots/mobile/school_admin-phone-super-admin__subscriptions.png` | subscriptions | FR | 390x844 | Boundary renders correctly on mobile |
| `screenshots/arabic/school_admin-ar-super-admin__subscriptions.png` | subscriptions | AR | Desktop | Boundary renders correctly RTL |

**14 screenshots for 12 routes.**

### Important limitation — read this before judging the evidence
**There is no TOTP secret on disk**, so `superadmin@schoolos.ma` cannot sign in
(`CONTEXT.md`: that account requires TOTP). The sweep confirms it:
`LOGIN FAILED for super_admin; aborting sweep`.

Consequently:
- every capture is of the **access-denied boundary**, not of the platform screens
  themselves;
- the changed behaviour (entitlement expiry) is only visible on super-admin
  screens, so it is proven by **tests**, not by pixels;
- no super-admin screenshot was fabricated.

To complete the visual pass, supply `TOTP_SECRET_FILE` and re-run the sweep as
`super_admin`. This is a credential gap, not a product defect.

## 10. Files Changed

```text
lango-app/src/libs/api/entitlements.ts                                        (F-01: + isExpiredAt)
lango-app/src/features/subscriptions/services/license-expiry-worker.ts        (F-01)
lango-app/src/features/subscriptions/__tests__/entitlement-expiry.test.ts     (NEW, 7 tests)
+ this done-folder package (report, checkpoint, screenshots, evidence)
```

## 11. Unresolved / Follow-up Items

- **Visual pass under super_admin** (needs `TOTP_SECRET_FILE`) — see §9.
- **Plan downgrade behaviour** is only partially modelled: `plan_limits` are
  readable, but there is no explicit "downgrade below current usage" guard. A
  downgrade can leave a tenant above its new limits with no enforcement visible
  in this layer. Product decision, not an audit fix.
- **`isExpiredAt` instant parsing** uses `new Date(expiresAt)`, which reads a
  naive text as host-local. All current writers use `z.iso.date()` or
  `.toISOString()`, so this is unambiguous today; if a naive timestamp ever gets
  written, apply the `storedInstant` treatment from AUD-OPS-01.

## 12. Frozen-Module / Cross-Module Impact

School-level Settings, HR, Finance, Admissions, Academics, Attendance and Support
were **not** touched. The change is confined to the platform entitlement rule and
its suspension worker.

**Blast radius is wider than the file count:** `isActive` is called by every
`requireAddon` in the product. The change makes entitlements **more permissive**
only on the final day of a paid period (inclusive instead of cutting at 00:00),
which is the customer-correct reading. Regression evidence: 137/137 tests across
`src/features/subscriptions` and `src/libs/api`, including the entitlement,
subscription-enforcement, permission, page-guard and nav-parity suites.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: a0eedbc1c5eeb38895c01e452dc86ade25c3b5f9
OPEN CLAIMS: 0 / 2 released (task:AUD-PLATFORM-01, task:port-3462)
READY FOR AGENT 5: YES
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
