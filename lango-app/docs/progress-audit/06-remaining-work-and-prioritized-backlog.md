# Remaining Work — Prioritized Backlog

Full machine-readable version: `remaining-work-backlog.csv` (29 items). This document explains the priority bands and delivery order; the CSV has task-level detail (dependencies, complexity, category, acceptance-relevant notes).

## Priority definitions used

- **P0 — Critical blocker.** Nothing else matters until this is done. 3 items: the compile errors, the database being down, and re-running the full test suite once it's back up.
- **P1 — Required before pilot.** Real gaps that would embarrass or actively harm a pilot school if left as-is. 8 items.
- **P2 — Important improvement.** Genuine value, not currently blocking anything. 14 items — the bulk of the Academics automation wishlist lives here.
- **P3 — Optional / future.** 3 items, including building out real automated test coverage — labeled P3 not because it's unimportant, but because it's the largest single item in the backlog and shouldn't compete for attention against smaller P0/P1 fixes.

## Recommended delivery order

1. **This week:** all 3 P0 items. None require a design decision or new scope — they're pure "make what already exists actually work" tasks.
2. **Before any pilot conversation:** the P1 list, in particular the Office Accounting ledger decision (§13.5) — this is the one item that needs a person, not an engineer, to unblock it. Flag it to whoever owns product decisions immediately; everything else in P1 can proceed in parallel.
3. **Opportunistic, module by module:** the P2 Academics-automation cluster. These are all real, valuable, and independently deliverable — no need to batch them into one big release.
4. **Ongoing, budget permitting:** P3, especially real test coverage. This is the item most likely to be quietly deprioritized forever if not explicitly scheduled — recommend treating it as a standing 10-20% time allocation rather than a one-off project.

## What's explicitly NOT on this list

Per the audit's own findings, everything in `feature-status-matrix.csv` marked "Complete and verified" or "Complete but insufficiently tested" is **not** backlog — insufficient testing is a real gap (tracked as the P3 test-coverage item, module-agnostic) but the features themselves work. Re-litigating already-fixed items wastes the credibility this audit is trying to establish.

## One item that needs a decision, not code (repeated here because it's easy to miss in a CSV)

**§13.5 — Office Accounting vs. the real ledger.** Two disconnected expense-recording pipelines exist. A separate, unused route already has the correct GL-posting logic. The fix is small once decided. **The decision itself — should this stay a labeled petty-cash log, or should it feed the real ledger — belongs to whoever owns the product, not to whichever engineer picks up the ticket.** This has been flagged multiple times across this project's history and should not be allowed to sit unresolved indefinitely, since it's a real financial-data-integrity question, not a preference.
