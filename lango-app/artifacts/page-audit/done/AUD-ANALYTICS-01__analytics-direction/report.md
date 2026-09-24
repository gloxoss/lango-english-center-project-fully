# AUD-ANALYTICS-01 — Analytics + Direction + Executive Reporting — Executor Report

## 1. Handoff Metadata

- Executor: codex-2 (Executor C)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-c/AUD-ANALYTICS-01-analytics-direction`
- Implementation SHA(s): see §13
- Hub item: `task:AUD-ANALYTICS-01` (+ `task:port-3461`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-ANALYTICS-01__analytics-direction/`
- Collision check before claim: **clean** — no active campaign held analytics,
  leadership or reporting.

## 2. Scope

**Owned:** the analytics / read / reporting layer only.

### Pages audited (10)

| # | Route | Role(s) | Purpose | Result |
|---|---|---|---|---|
| 1 | `/dashboard/analytics` | school_admin | Executive dashboard + KPIs | **FIXED (F-01..F-05)** |
| 2 | `/dashboard/portals/leadership` | school_admin | Direction home | **FIXED (same KPI source)** |
| 3 | `/dashboard/portals/leadership/admin` | school_admin | Direction admin | PASS |
| 4 | `/dashboard/portals/leadership/approvals` | school_admin | Approvals queue | PASS |
| 5 | `/dashboard/portals/leadership/exceptions` | school_admin | Exceptions | PASS |
| 6 | `/dashboard/reports` | school_admin | Report catalogue | PASS |
| 7 | `/dashboard/reports/admin` | school_admin | Report admin console | PASS |
| 8 | `/dashboard/reports/runs` | school_admin | Report run history | PASS |
| 9 | `/dashboard/reports/schedules` | school_admin | Scheduled reports | PASS |
| 10 | `/dashboard/super-admin/reports` | super_admin | Platform reports | PASS (correctly denied to school_admin) |

### API surface audited
`/api/analytics` (381 lines, the KPI source), `/api/leadership/*` (6:
`me/{home,approvals,exceptions}`, `admin/{authorities,scopes}`),
`/api/addons/reporting/*` (12: catalog, favorites, saved-views, schedules,
`reports/[key]/{preview,run}`, `runs`, `runs/[id]`, `runs/[id]/download`,
`runs/recover`, `admin/console`).

### Explicitly out of scope (frozen source modules — excluded per brief)
`/dashboard/finance/{reports,statements}`, `/dashboard/hr/overview`,
`/dashboard/attendance/qr-reports`, `/dashboard/academics/live-class-reports`,
`/dashboard/hostel/reports`, `/dashboard/transport/reports`,
`/dashboard/inventory/overview`, `/dashboard/broadcast/reports`,
`/dashboard/communication/delivery-reports`,
`/dashboard/portals/librarian/reports`. Those pages render over frozen modules
(Attendance, Academics, GL, Admissions, HR, Finance) and were **not** modified.

### Frozen dependencies not modified
`libs/finance/definitions.ts` (read and now **used**, not changed),
`libs/finance/today.ts`, and every source module listed above.

## 3. Workflow Understanding

`/api/analytics` is the single KPI source for the executive dashboard and the
direction portal home. It aggregates: headcounts (students/teachers/staff/classes),
enrolment this month and a 6-month trend, a 30-day attendance rate, finance
totals (invoiced / collected / outstanding / discounts + collection rate),
average assessment percentage, open attendance flags by severity, overdue
receivables, locked accounts, and the composite **IGP** score with its trend.

**Source of truth for money is `libs/finance/definitions.ts`**, which CONTEXT.md
makes mandatory: *"use `libs/finance/definitions.ts` helpers … Never invent a
local formula."* It defines `INVOICED_INVOICE_STATUSES`,
`OVERDUE_INVOICE_STATUSES`, `overdueInvoiceCondition(status, dueDate, today)`,
`invoicedInvoiceCondition`, `collectedPaymentCondition`, and
`netCollectedSumSql` (posted payments **net of approved refunds**).

## 4. Findings

| ID | Severity | KPI | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| **F-01** | **High** | Collected / collection rate | `sum(payments.amount)` where `status='posted'` **ignored approved refunds**. A partially refunded payment stays `posted`, so cash kept was **overstated**. | Deviation from `netCollectedSumSql` | **FIXED** |
| **F-02** | **High** | Overdue receivables | Counted only `status = 'overdue'`. Canonical rule is status in `pending/partial/overdue` **AND** `dueDate < today`. Every past-due invoice still sitting in `pending`/`partial` was **missing** from the director's overdue count. | `isOverdueInvoice` semantics | **FIXED** |
| **F-03** | Med | Collection rate | The headline ratio was **not clamped** to 100 while the per-month IGP variant was. Combined with F-01 the dashboard could display a rate **above 100%**. | Line 250 vs line 282 | **FIXED** |
| **F-04** | Med | Invoiced total | Hand-rolled `status NOT IN ('draft','cancelled','credited')` instead of `invoicedInvoiceCondition`. Equivalent today for known statuses, but it is a second definition of "invoiced" that can drift from Finance. | Deviation from `invoicedInvoiceCondition` | **FIXED** |
| **F-05** | Med | Every date window | `isoDate` used `d.toISOString().slice(0,10)` = **UTC** day. Same family as AUD-OPS-01 F-02 and AUD-LIBINV-01 F-01. Shifts `today`, `monthStart`, `thirtyDaysAgo` and `sixMonthsAgo` during Moroccan mornings, so 30-day and month buckets move. | `libs/finance/today.ts` rationale | **FIXED** |

**No FROZEN MODULE CONTRADICTION.** The frozen Finance module is correct; the
analytics **consumer** contradicted it. Fixing the consumer to call the canonical
helpers does not redesign Finance.

### Verified fine against the brief's checklist
- **Cross-tenant leakage:** every query is `eq(tenantId, ctx.tenantId)`; the route
  is `['school_admin']`-gated and resolves the tenant from the session.
- **Cross-branch leakage / hidden branch filters:** these KPIs are tenant-wide by
  design and school_admin is full-school scope; no branch filter is silently
  applied and none is silently dropped.
- **Stale cached values:** every read is `cache: 'no-store'` / live query; no cache.
- **Misleading zero/all-clear states:** rates return `null` (not `0`) when their
  denominator is zero, and a month with no invoicing gets **no** finance pillar
  rather than a fabricated 0.
- **Sensitive finance/HR leakage:** route asserts `school_admin`.
- **Role boundaries:** `/dashboard/analytics` returns `access-denied` to a teacher
  (captured); `/dashboard/super-admin/reports` denies school_admin (captured).
- **CSV/export leakage:** `runs/[id]/download` is behind the same report run
  guards and tenant scope as its parent run.

## 5. Fixes Implemented

All five are in `src/app/api/analytics/route.ts`.

- **F-01:** `sum(payments.amount)` → `netCollectedSumSql(payments)`, which nets
  approved refunds per payment. Values arrive as numeric-text, so the aggregates
  are coerced with `Number(...)` before use.
- **F-02:** `invoices.status = 'overdue'` →
  `overdueInvoiceCondition(invoices.status, invoices.dueDate, today)`.
- **F-03:** `collectionRate` and `attendanceRate30d` clamped to `Math.min(100, …)`,
  matching the per-month variant.
- **F-04:** the hand-rolled status filter → `invoicedInvoiceCondition(invoices.status)`.
- **F-05:** `isoDate` → `casablancaTodayIso(d)`.

Also removed a dead `STAFF_ROLES` constant (never read; the role list is inlined
in the query) so the touched file lints clean.

**Regression risk:** low. Read-only aggregation; no writes, no schema change. The
numbers move only where they were wrong.

## 6. Security / Isolation / Permission Audit

- **Tenant isolation:** `npm run check:isolation` **PASS** (828 files).
- **Branch isolation:** see §4; no silent branch filter on tenant-wide KPIs.
- **Page guard:** all 10 pages call `requireServerPage`; role boundaries captured.
- **API guard:** `/api/analytics` → `requireRequestContext(['school_admin'])` +
  `requireTenant`. Leadership and reporting routes gate by capability.
- **IDOR:** reporting `runs/[id]` and `reports/[key]` lookups are tenant-scoped.
- **Request validation:** reporting routes use Zod `.strict()`; analytics is read-only.
- **Sensitive-data exposure:** finance/HR aggregates are only exposed to
  school_admin and super_admin surfaces.
- **Audit logging:** read-only routes correctly do not audit.

## 7. Data / DB / Migration Impact

- **Tables read:** `user`, `classes`, `attendance`, `attendance_flags`, `invoices`,
  `payments`, `refunds` (via `netCollectedSumSql`), `assessment_results`,
  `assessments`, plus leadership/reporting tables.
- **Tables written:** none. Read-only.
- **Historical data changed:** **none.**
- **Migration added:** none. **Journal status:** untouched.

## 8. Tests

### Focused tests
```text
npx vitest run src/features/dashboard src/features/leadership  ->  14/14 PASS
  executive-kpi-truth.test.ts (NEW, 7):
    - canonical finance conditions are used
    - the hand-rolled invoiced/overdue filters are gone
    - approved refunds are netted out of collected
    - no UTC date extraction
    - every displayed percentage is clamped to 0..100
    - the canonical definitions' semantics (isOverdueInvoice) still hold
    - the Casablanca midnight edge is respected
  leadership/services/scope-service.test.ts  7 passed (pre-existing, green)
```

### Runtime regression I introduced and caught
The first implementation wrapped `netCollectedSumSql(payments)` inside the
original `sql`…`` template, so Postgres received the **literal text**
`netcollectedsumsql(payments)` as a function name and `/api/analytics` returned
**500**. The screenshot sweep caught it immediately
(`500 /api/analytics | error screen: «erreur interne»` on two pages). After
removing the wrapper and restoring the import that `eslint --fix` had dropped as
unused, the re-sweep shows **`ok`** for both pages. This is why the evidence
includes a recheck rather than a single pass.

### Static gates
```text
check:types      PASS   (tsc --noEmit, 0 errors)
check:isolation  PASS   (828 files scanned)
check:i18n       PASS   (missing translation keys: 0 in 0 files)
check:ui         PASS   (ratchet holding)
eslint touched   PASS   (0 problems on both touched files)
```

## 9. Visual / UX Evidence

### Screenshot manifest
| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/school_admin-fr-*.png` (9) | all nine direction/reporting pages | FR | Desktop 1440x900 | Each renders real data after the fix |
| `screenshots/school_admin-fr-super-admin__reports.png` | platform reports | FR | Desktop | Honest denial for non-super_admin |
| `screenshots/teacher-fr-analytics.png` | executive dashboard as teacher | FR | Desktop | Role boundary: `access-denied` |
| `screenshots/mobile/school_admin-phone-analytics.png` | executive dashboard | FR | 390x844 | Usable on mobile |
| `screenshots/arabic/school_admin-fr-analytics.png` | executive dashboard | AR | Desktop | RTL rendering |

**13 screenshots covering all 10 routes**, plus mobile 390 and Arabic RTL on the
main changed route (`/dashboard/analytics`), as the brief requires.

Coverage rules applied:
- every audited route: final desktop FR — **yes, 10/10**.
- important/changed routes: mobile 390 + Arabic RTL — **yes** for
  `/dashboard/analytics`, the route that consumes every changed KPI.
- before/after — proven numerically rather than visually: the KPIs changed value,
  not layout. The 500 regression is documented in §8 with the exact sweep output.

## 10. Files Changed

```text
lango-app/src/app/api/analytics/route.ts                                (F-01..F-05)
lango-app/src/features/dashboard/__tests__/executive-kpi-truth.test.ts  (NEW, 7 tests)
+ this done-folder package (report, checkpoint, screenshots, evidence)
```

## 11. Unresolved / Follow-up Items

- **Module-owned report pages** (finance, HR, attendance, academics, hostel,
  transport, inventory, broadcast, communication, librarian) were deliberately
  excluded as frozen-source surfaces. If you want a second pass over those, that
  is a separate campaign with the owning modules' consent.
- **`netCollectedSumSql` returns numeric-as-text.** Every new caller must coerce
  with `Number(...)`; a typed helper returning `SQL<number>` would be safer.
- **IGP weighting is opaque.** The composite score mixes attendance, finance and
  assessment pillars with weights summed inside the route. The weights are not
  tenant-configurable and are not surfaced in the UI, so a director cannot see why
  the number moved. Product decision, not an audit fix.

## 12. Frozen-Module / Cross-Module Impact

No frozen source module was modified. `libs/finance/definitions.ts` and
`libs/finance/today.ts` were **read and consumed**, never changed. The change is
confined to the read-only aggregation layer.

Regression evidence: `leadership/services/scope-service.test.ts` (7) still passes,
`check:isolation` passes, and the direction/reporting pages render after the fix.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: c79d1ed8c37f32dce4ab28f648879533eefbb423
OPEN CLAIMS: 0 / 2 released (task:AUD-ANALYTICS-01, task:port-3461)
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
