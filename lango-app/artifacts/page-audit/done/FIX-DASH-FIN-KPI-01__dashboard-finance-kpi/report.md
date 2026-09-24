# FIX-DASH-FIN-KPI-01 — Main Dashboard Finance KPI Truth — Executor Report

## 1. Handoff Metadata

- Executor: codex-2 (Executor C)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-c/FIX-DASH-FIN-KPI-01-dashboard-finance-kpi`
- Implementation SHA(s): see §13
- Hub item: `task:FIX-DASH-FIN-KPI-01` (+ `task:port-3465`)
- Done folder: `lango-app/artifacts/page-audit/done/FIX-DASH-FIN-KPI-01__dashboard-finance-kpi/`
- Collision check (preflight `git fetch` + `hub status` + `hub next`): **clean**.
  Note `AUD-SAFETY-01` (opencode-1) now owns `src/libs/finance/today.ts` — read only here.
- **Not reopened:** AUD-FINANCE-01 and AUD-ANALYTICS-01 were left untouched
  (both frozen/verified). No contradiction was found in them.

## 2. Scope

Narrow central integration repair, as briefed. Owned and edited:

```text
src/app/api/dashboard/summary/route.ts      (the single dashboard data source, 978 lines)
src/features/dashboard/__tests__/finance-kpi-truth.test.ts   (new)
```

**Data path (§3 of the brief):**
```
/dashboard  (server page: resolveLandingPath -> DashboardView)
  → GET /api/dashboard/summary        [requireRequestContext(['school_admin']) + requireTenant]
  → parallel Drizzle aggregates       (invoices / payments / attendance / classes …)
  → libs/finance/definitions.ts       (invoicedInvoiceCondition, collectedPaymentCondition,
                                       overdueInvoiceCondition, netCollectedSumSql)
  → tables: invoices, payments, refunds
```

## 3. Root cause — why the dashboard diverged

The dashboard **already imported** the canonical Finance helpers. The divergence was
not in *which* status sets were used; it was in **what the ratio compared**.

Two KPIs divided **cash received** by **invoices raised**:

- `dailyPulse.periodCollected.rate` = `monthCollected / monthInvoiced`
- `financeOverview.collectionRate`  = `periodCollectedTotal / periodInvoicedTotal`

Those are two different populations. Cash collected in month M routinely settles
invoices from **earlier** months. On the seeded tenant that produced the impossible
number the brief describes.

## 4. Deterministic probe (real seed data, Groupe Scolaire Atlas, Sept 2026)

| Figure | Value | Source |
|---|---|---|
| invoiced | 2 162 000 MAD | `invoicedInvoiceCondition` |
| still owed on those invoices | 599 500 MAD | `greatest(net − paid, 0)` |
| collected cash | 2 553 500 MAD | `netCollectedSumSql` (net of approved refunds) |

```
OLD  = collected cash / invoiced        = 2 553 500 / 2 162 000 = 118.1 %   <-- IMPOSSIBLE
NEW  = (invoiced − outstanding)/invoiced = 1 562 500 / 2 162 000 =  72.3 %   <-- in range
```

On screen, before the fix, both cards showed it: the pulse card **118%** and
"Taux de recouvrement" **118.1%**, while "Restant dû" read **0 MAD** — a direct
self-contradiction, since families demonstrably still owed 599 500 MAD on this
year's invoices.

Full figures: `evidence/deterministic-kpi-probe.txt`.

## 5. KPI definitions now in force

| KPI | Definition | Bounded? |
|---|---|---|
| invoiced | `sum(net_amount)`, status ∈ `INVOICED_INVOICE_STATUSES` | n/a |
| collected | posted payments **net of approved refunds** (`netCollectedSumSql`) | n/a |
| outstanding | `sum(greatest(net − paid, 0))` — real balance on those invoices | ≥ 0 |
| overdue | `OVERDUE_INVOICE_STATUSES` **and** past due (`overdueInvoiceCondition`) | n/a |
| recovery rate | `(invoiced − outstanding) / invoiced` | **≤ 100 by construction** |

**No third Finance formula was created.** The five figures come straight from
`libs/finance/definitions.ts`. Only the *ratio* was corrected.

**Why ≤ 100 needs no clamp:** `outstanding` is summed as `greatest(net − paid, 0)`
**per invoice**, so it cannot be negative; therefore `paid-on-invoices = invoiced −
outstanding ≤ invoiced`. Legacy overpayment (paid > net on one invoice) contributes
0 outstanding and 100% coverage for it — correct, since everything billed there has
been settled. If the rate ever exceeds 100 again it means the numerator or
denominator regressed, and the number will show it rather than a clamp hiding it.

## 6. Fixes Implemented

**A. `dailyPulse.periodCollected.rate`** — now invoice-based via a new query that
sums `greatest(net − paid, 0)` over this month's invoices (same filters as the
existing invoiced query). Zero invoiced yields `null` (unknown), not `0%`.

**B. `financeOverview.collectionRate` + `.outstanding`** — outstanding now comes
from the per-month `open` figure the period query already had (it just wasn't
selected), instead of `max(0, invoiced − cash)`. The rate follows. This is what
removed the 118.1% card and the "Restant dû 0" contradiction simultaneously.

Files: `src/app/api/dashboard/summary/route.ts`.

## 7. Role / scope checks (§4 of the brief)

| Check | Result | Evidence |
|---|---|---|
| school_admin | **PASS** — full school-wide financial summary | dashboard + `financeOverview` render |
| accountant | **PASS** — correct permitted summary | portal manifest routes accountants to `/dashboard/finance`; this dashboard is not their surface, so nothing is denied that was promised |
| teacher | **PASS** — no Finance leakage | `/api/dashboard/summary` is `['school_admin']`-only; `/dashboard` redirects each role via `resolveLandingPath` before rendering |
| tenant isolation | **PASS** | `check:isolation` green; every finance query carries `eq(invoices/payments.tenantId, tenantId)` |
| branch scope | **PASS** | `userBranchFilter` / `classBranchFilter` applied on every finance aggregate — all-branches or one branch |
| dashboard ↔ analytics | **PASS** | both now derive from the same `libs/finance/definitions.ts` helpers; the impossible >100% is gone from both |

Labels that genuinely differ, documented rather than forced equal: the dashboard's
`collected` field is **cash received** (the card says "Encaissé"), while the rate is
**share of billing settled**. Those are different concepts on purpose.

## 8. Tests

```text
npx vitest run src/features/dashboard  ->  8/8 PASS
finance-kpi-truth.test.ts (new, 8):
  - the route no longer divides cash collected by invoices raised
  - rate derives from invoiced − outstanding, with per-invoice flooring
  - bounded to [0,100] across fully-paid / partial / all-unpaid / legacy-overpay
  - zero invoiced → null, not a false 0%
  - collected uses netCollectedSumSql (refunds subtracted)
  - canonical conditions used; no hand-rolled status filters
  - tenant + branch scoping present on every finance aggregate
  - teacher can never be served this summary
```

## 9. Static gates

```text
check:types      PASS   (tsc --noEmit, 0 errors)
check:isolation  PASS   (828 files)
check:i18n       PASS
check:i18n:keys  PASS   (0 missing)
check:ui         PASS   (ratchet holding)
eslint touched   3 errors — ALL PRE-EXISTING, zero introduced
```

The 3 lint errors (`classSectionId` unused at 59; `no-unmodified-loop-condition`
on the monthly bucket loop) were verified present on the base commit by running
eslint against `git show f42c2bc:<path>` — identical, at lines 59/696. They are in
code this change did not write.

## 10. Visual / UX Evidence

| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/before/school_admin-fr-home.png` | dashboard, old formula | FR | Desktop 1440x900 | **118%** pulse + **118.1%** "Taux de recouvrement" with "Restant dû 0 MAD" |
| `screenshots/after/school_admin-fr-home.png` | dashboard, fixed | FR | Desktop | invoice-based rate, consistent with outstanding |
| `screenshots/mobile/school_admin-fr-phone-home.png` | dashboard | FR | 390x844 | mobile usable |
| `screenshots/arabic/school_admin-ar-home.png` | dashboard | AR | Desktop | RTL renders |

Captured via `scripts/visual-sweep.mjs` (read-only, fully loaded — the sweep waits
for `networkidle` plus 2s before shooting, so no skeleton states).

## 11. Unresolved / Follow-up Items

- **`monthlyBreakdown[].remaining` is still cash-based** (`max(0, invoiced − cash)`
  per month). The headline `outstanding` is now correct, but a per-month bar could
  still read 0 remaining while that month's invoices are partly unpaid. Same root
  cause, one level down. Left as follow-up to avoid widening a narrow repair.
- **Over-collection presentation.** When families overpay relative to a month's
  invoicing, "collected" is truthfully higher than "invoiced"; only the *rate* is
  bounded. If product wants that surfaced, an explicit "credit/overpayment" figure
  would be the honest addition.
- The 3 pre-existing lint errors in the touched file (see §9).

## 12. Frozen-Module / Cross-Module Impact

`libs/finance/definitions.ts` and the verified Analytics route were **read only**,
unchanged. No contradiction was found in them, so nothing was stopped for. Only the
dashboard's own aggregation changed.

Regression evidence: 8/8 new tests green, `check:isolation` green, and the only
touched production file is the dashboard summary route.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: 8dedade3d2e9b5251b7108267b8ce447ec9933dc
DASHBOARD ↔ ANALYTICS CONSISTENCY: PASS
TENANT/BRANCH ISOLATION: PASS
TEACHER FINANCE CONFIDENTIALITY: PASS
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
