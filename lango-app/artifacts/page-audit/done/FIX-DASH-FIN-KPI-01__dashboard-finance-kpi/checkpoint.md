# FIX-DASH-FIN-KPI-01 — CHECKPOINT

- task: FIX-DASH-FIN-KPI-01 — Main Dashboard Finance KPI Truth
- agent: codex-2 (Executor C)
- base: f42c2bc | worktree: C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-FIX-DASH-01
- branch: audit/agent-c/FIX-DASH-FIN-KPI-01-dashboard-finance-kpi
- claims: task:FIX-DASH-FIN-KPI-01, task:port-3465 | dev: port 3465
- collision check: clean. AUD-SAFETY-01 owns libs/finance/today.ts (read only).
- NOT reopened: AUD-FINANCE-01, AUD-ANALYTICS-01 (frozen/verified).

## ROOT CAUSE
Two dashboard KPIs divided CASH RECEIVED by INVOICES RAISED - two different
populations, since cash in month M settles earlier invoices:
  dailyPulse.periodCollected.rate = monthCollected / monthInvoiced
  financeOverview.collectionRate  = periodCollectedTotal / periodInvoicedTotal
Seeded proof (Atlas, Sept 2026): invoiced 2 162 000, outstanding 599 500,
cash 2 553 500 -> OLD 118.1% (impossible), NEW 72.3%.

## FIX (2 sites, src/app/api/dashboard/summary/route.ts)
- dailyPulse rate: invoice-based via a new greatest(net-paid,0) query on this
  month's invoices. Zero invoiced -> null, not 0%.
- financeOverview outstanding + rate: outstanding now sums the per-month `open`
  figure the period query already had but did not select; rate = (invoiced -
  outstanding)/invoiced. This also removed the "Restant dux 0 MAD while families
  still owe" contradiction.

## WHY NO CLAMP
outstanding is summed as greatest(net-paid,0) PER INVOICE, so >= 0, therefore
paid-on-invoices <= invoiced and the rate is <= 100 by construction. A rate above
100 now means the numerator/denominator regressed - visible, not hidden.

## KPI DEFINITIONS (all reused from libs/finance/definitions.ts - no third formula)
invoiced  sum(net) status in INVOICED_INVOICE_STATUSES
collected posted payments NET OF approved refunds (netCollectedSumSql)
outstanding sum(greatest(net-paid,0))
overdue   OVERDUE_INVOICE_STATUSES AND past due (overdueInvoiceCondition)
rate      (invoiced-outstanding)/invoiced   -> bounded

## RESULT
8/8 tests (new finance-kpi-truth.test.ts). types/isolation/i18n/i18n:keys/ui PASS.
eslint: 3 errors, ALL PRE-EXISTING (verified against git show f42c2bc:<path>).
Screenshots: before (118% / 118.1%), after, mobile 390, AR RTL.

## LEFT (see report section 11)
- monthlyBreakdown[].remaining is still cash-based (same root cause, one level down).
- over-collection has no explicit credit figure.
- the 3 pre-existing lint errors.
