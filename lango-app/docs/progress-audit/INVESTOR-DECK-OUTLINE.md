# Investor Deck Outline

Built from this audit's evidence only. **Do not add claims to any slide that aren't traceable to a document in this directory.** Every slide below cites its source.

## Slide 1 — Title
SchoolOS: a multi-tenant, Morocco-focused school-management platform.

## Slide 2 — The Problem
Schools in Morocco run on fragmented tools (spreadsheets, paper, generic non-localized software) for admissions, attendance, finance/payroll, and campus operations. *(Business framing — not directly evidenced in the repo; confirm this framing with whoever owns the product vision before using it.)*

## Slide 3 — The Product
One platform, 22+ modules: admissions, academics, attendance, finance (real double-entry ledger), Moroccan-specific payroll (CNSS/AMO/IR), HR, library, hostel, transport, campus security, events. *(Source: `04-complete-feature-inventory.md`.)*

## Slide 4 — What's Built (the honest version)
- 68 commits, ~4.5 weeks, real architectural depth.
- A documented, deliberate security-hardening pass across every write endpoint.
- 40 of 43 items from an independent, code-verified product review confirmed fixed.
*(Source: `03-chronological-progress.md`, `00-executive-summary.md`.)*

## Slide 5 — Proof, Not Claims
- 1,842 hardcoded fake invoice rows found and replaced with real data (commit `1dc827a`).
- A tenant-isolation fail-open bug found and fixed same-day (commit `d6e4c9f`).
- The Accountant Portal has its own documented self-audit-and-fix cycle — the strongest verification evidence of any module.
*(Source: `03-chronological-progress.md`, `13-risks-security-and-technical-debt.md`.)*

## Slide 6 — Current Stage, Stated Plainly
Working alpha with real depth, not yet tested or deployed. Build currently has 3 compile errors (unfixed, disclosed). Zero confirmed-passing automated test runs. No evidence of a production deployment.
*(Source: `05-current-product-state.md`, `07-testing-results.md`. This slide is not optional — omitting it would make the deck inconsistent with the technical audit, which the brief explicitly prohibits.)*

## Slide 7 — Readiness Scorecard
Show the 15-dimension table from `00-executive-summary.md` / `05-current-product-state.md` directly — don't round the numbers up.

## Slide 8 — The Path to Pilot-Ready (30/60/90)
Days 0-30: fix build, restore DB, run real tests. Days 30-60: automated test coverage on Finance/Payroll/RBAC, real staging deployment. Days 60-90: one real school pilot.
*(Source: `14-30-60-90-day-roadmap.md`.)*

## Slide 9 — Use of Funds (if raising)
Map directly to the roadmap: engineering time for P0/P1 backlog closure, a security/privacy review before real student data, and the automated-test-coverage build-out.
*(Source: `06-remaining-work-and-prioritized-backlog.md` — do not invent categories not backed by the backlog.)*

## Slide 10 — Risks & Mitigations
Bus factor (single contributor identity to date), untested financial code, no deployment evidence, data-privacy review pending for a product handling minors' PII.
*(Source: `09-investor-update.md`, `13-risks-security-and-technical-debt.md`.)*

## Slide 11 — The Ask
*(Business-specific — not evidenced in the repo. Fill in with the actual funding/partnership ask once decided; this outline cannot generate that number.)*

## Slide 12 — Close
One sentence: real engineering rigor, honestly not yet production-ready, a clear and inexpensive path to being pilot-ready within 30-60 days.
