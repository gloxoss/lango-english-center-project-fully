# 30/60/90-Day Roadmap

Built directly from `remaining-work-backlog.csv` — every task below traces to a specific backlog row.

## Days 0-30: Stabilize

**Goal: a build that compiles cleanly, a database that's confirmed working, and a first real (not manual) test-pass record.**

| Task | Priority | Complexity |
|---|---|---|
| Fix 3 TypeScript compile errors (Events attachments/route, Events [id]/route, homework-service.ts) | P0 | Small |
| Restart and stabilize Postgres/docker-desktop; confirm migrations through 0127 apply cleanly | P0 | Small |
| Run `npm run test`, `npm run lint`, `npm run test:e2e`, `npm run build` end to end and record real results | P0 | Small |
| Resolve the Office Accounting ↔ real-ledger product decision, then implement the small fix it unlocks | P1 | Small |
| Add row-level action buttons to Students Directory | P1 | Small |
| Fix Office Accounting receipt-upload input | P1 | Small |
| Add class/section bulk-select for convocations + card-issuance profile entry points | P1 | Small |

**Exit criteria:** clean `tsc --noEmit`, a passing (or honestly documented failing) test suite run, and the Office Accounting decision closed.

## Days 30-60: Verify and harden

**Goal: real automated test coverage on the highest-risk modules, and a confirmed working deployment.**

| Task | Priority | Complexity |
|---|---|---|
| Build automated test coverage for Finance, Payroll, and RBAC specifically | P3 (but scheduled here deliberately, not deferred indefinitely) | XL |
| Build/confirm a real staging deployment with basic monitoring | — (not in backlog CSV; a Phase-4 finding, not a review-derived item) | Medium |
| Alumni auto-transition scheduled job | P1 | Medium |
| Student/employee photo gallery | P1 | Medium |
| Events: full edit page + attachments API + public-site consumer | P1 | Large |
| Begin the P2 Academics-automation cluster, module by module (class-creation bundle, then period-mode, then the smaller automation items) | P2 | Large (bundle), then Medium/Small individually |

**Exit criteria:** a demo-and-pilot-ready staging environment with monitoring, and the first tranche of automated tests protecting the modules most likely to cause real financial or authorization harm if they silently break.

## Days 60-90: Pilot

**Goal: real usage data from one real school, on the modules already confirmed strongest.**

| Task | Priority |
|---|---|
| Complete a dedicated security/privacy review before onboarding real student data | Not in backlog CSV — a Phase-4/Phase-5 finding |
| Onboard one pilot school, scoped to Academics, Attendance, and the Accountant Portal (the three modules with the strongest verification evidence) | — |
| Continue the P2 Academics-automation backlog opportunistically | P2 |
| Produce a second, pilot-informed product review, following the same screen-by-screen evidence-based method that produced `PRODUCT-REVIEW-AND-FIXES.md` | — |

**Exit criteria:** a real school has used the product for real operational work for at least 2-4 weeks, and a second review exists comparing what the pilot actually surfaced against what this audit predicted.

## What's deliberately NOT in the first 90 days

The full P2/P3 Academics-automation wishlist (auto-timetable solver, substitute-teacher workflow, exam auto-variations, etc. — see `remaining-work-backlog.csv`) is real, valuable, and explicitly *not* scheduled for the first 90 days. None of it blocks a pilot. Pulling it forward would trade pilot-readiness for feature-breadth, which this roadmap deliberately does not do.
