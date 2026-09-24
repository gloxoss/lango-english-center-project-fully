# AUD-PLATFORM-01 — CHECKPOINT (resume point)

- task: AUD-PLATFORM-01 — Super Admin + Tenant Lifecycle + Subscription / Add-on Entitlements
- agent: codex-2 (Executor C)
- target branch: origin/student-directory-hardening
- base: f42c2bc41cb2386afed52244c5355c31c8a91f96 (fetched, unchanged)
- worktree: `C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-AUD-PLATFORM-01`
- branch: `audit/agent-c/AUD-PLATFORM-01-platform-entitlements`
- hub claims held: `task:AUD-PLATFORM-01`, `task:port-3462`
- collision check before claim: CLEAN (antigravity-1 holds AUD-FINANCE-01 only)
- dev server: port 3462, `NEXT_DIST_DIR=.next-agentc`, DATABASE_URL -> `schoolos_audit`
- node_modules: `npm install --ignore-scripts` DONE
- **EDIT IN THE WORKTREE.** Bash heredocs mangle backslashes; use plain strings.

## ROUTE INVENTORY (discovered) — 12 pages, 26 super-admin API routes
  /dashboard/super-admin                  hub + summary
  /dashboard/super-admin/schools          tenant registry
  /dashboard/super-admin/schools/create   tenant lifecycle: create
  /dashboard/super-admin/schools/[id]     use bf635991-1c38-41d7-9999-41f5a04262f9 (Groupe Scolaire Atlas)
  /dashboard/super-admin/domains          domain bindings
  /dashboard/super-admin/subscriptions    subscriptions + licence
  /dashboard/super-admin/subscriptions/list
  /dashboard/super-admin/settings         plan limits, addon-definitions
  /dashboard/super-admin/waitlist         waitlist -> convert
  /dashboard/super-admin/reports
  /dashboard/super-admin/support
  /dashboard/super-admin/sms
API: addon-definitions, alerts, domains, domains/[id], entitlements, health,
     plan-limits, reports, schools, schools/[id], schools/[id]/branches,
     schools/anonymize, schools/backup, sms, subscriptions,
     subscriptions/[schoolId], subscriptions/[schoolId]/license,
     subscriptions/[schoolId]/payments/[paymentId]/decision, summary, support,
     waitlist, waitlist/convert
Plus cross-cutting: src/libs/api/entitlements.ts, src/libs/api/addon-catalog.ts
Plus src/app/api/platform (edge-tenant-resolve, caddy-ask) — tenant routing.

## FINDING + FIX (DONE in worktree)
F-01 **HIGH — FIXED** Entitlement and licence expiry cut off ~23 hours early.
  `expiresAt` is written from the entitlement/licence screens as a DATE-ONLY
  string (`z.iso.date()`), so it names a day the customer paid through. But:
   - `entitlements.isActive` did `new Date(expiresAt).getTime() > Date.now()`.
     `new Date('2026-12-31')` is UTC MIDNIGHT, so the module switched off at
     00:00 on the last paid day.
   - `runLicenseExpirySweep` compared `lt(expires_at, new Date().toISOString())`
     against a naive timestamp column — a different derivation again, so the gate
     and the suspension worker could disagree on a non-UTC host.
  FIX: one shared rule — expiry is inclusive of the named day, and "today" is the
  Casablanca business day (libs/finance/today.ts).
   - `isActive`: `casablancaTodayIso() <= expiresAt.slice(0, 10)`
   - worker: `const now = casablancaTodayIso()` so a licence is suspended only
     once its day has actually passed.
  Both files in scope: src/libs/api/entitlements.ts,
  src/features/subscriptions/services/license-expiry-worker.ts.
  TEST: src/features/subscriptions/__tests__/entitlement-expiry.test.ts (7 tests)
   — active through its expiry day, inactive after, disabled always denies,
   null = open-ended, tolerates a full timestamp, and the worker shares the rule.

## VERIFIED STRONG (do not "fix")
- `requireAddon` denies identically for missing / disabled / expired (no
  enumeration oracle) — documented in code.
- `assertAddonDependencies` enforces dependencies at activation AND blocks a
  deactivation that would strand a dependent add-on.
- `requireWorkforceAddon` enforces the hard payroll -> human-resources dependency.
- `addon-catalog.ts` falls back to the static registry so the catalog is never
  empty on a fresh DB.

## IMPORTANT LIMITATION
There is NO TOTP secret on disk, so `superadmin@schoolos.ma` cannot log in
(CONTEXT.md: that account needs TOTP). Super-admin page screenshots are therefore
captured as school_admin showing the honest access-denied boundary, NOT under the
real role. State this plainly in the report; do not fabricate super_admin shots.

## NEXT EXACT ACTION
1. Read /tmp/agentc-pf-gates.log (vitest + types/isolation/ui/i18n + eslint).
2. Finish the sweep on 3462 (12 routes + the super_admin login attempt).
3. Mobile 390 + AR RTL on /dashboard/super-admin/subscriptions (the route that
   shows licence expiry, i.e. the changed behaviour).
4. report.md from shared/REPORT_TEMPLATE.md with the route matrix and the
   lifecycle proofs: tenant create -> domain bind -> licence issue -> entitlement
   grant -> expiry -> suspension. Cover the brief's checks: cross-tenant leakage,
   destructive ops (schools/anonymize, schools/backup), licence decisions
   (payments/[paymentId]/decision), plan limits, waitlist convert.
5. commit -> push -> `hub done task:AUD-PLATFORM-01` -> release both -> stop.
