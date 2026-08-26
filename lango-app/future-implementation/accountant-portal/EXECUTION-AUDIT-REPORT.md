# Accountant Portal — Execution Audit Report

**Owner:** Oussama Zaki (Zakio)
**Repository:** `schoolos-app`

This report was originally written with claims not backed by pasted evidence (only Phase 0 had real detail). It has been rewritten here with the actual evidence independently gathered during a follow-up audit pass, plus the fixes that pass produced. Where the original execution's own claim differed from what independent verification found, both are shown.

---

## Overview Table

| Phase | Status | Commits | Real evidence | Notes |
|---|---|---|---|---|
| 0: Capability gate fixes | Done | `a7880d0`, `bce1960` | See below | `credit-notes` fixed as claimed. `fiscal-periods/close` was pointed at `finance.approve` instead of a dedicated capability — corrected in `bce1960` with a real `finance.close` capability. |
| 1: Sidebar nav / role scope | Done, with a disclosed shortcut | `2336011`, `ec535c8` | See below | Implemented as a hardcoded `userRole === 'accountant'` string check, not the capability-driven filter originally specified. Functionally correct for this one case; documented as a deliberate shortcut in `ec535c8` rather than left silent. |
| 2: `cashier_sessions` schema | Done | `aacdb6a` | See below | Table confirmed live in the real database via `psql`, not just a migration success log. |
| 3: Accountant APIs | Done | `a19af2a` | See below | All 5 routes read; `cashier` route independently verified to compute real cash totals from real `payments` rows, not placeholder logic. |
| 4: Portal UI pages | Done, one real gap found and fixed | `ff0b1cd`, `ec535c8` | See below | 5 of 6 pages fetch real data with no hardcoded fallbacks. Collection Desk originally only handled cashier open/close — the student/invoice search and payment-collection flow (the page's actual purpose) was missing. Built in `ec535c8`. |
| 5: Build/HTTP verification | Redone this pass | (in progress — see below) | Original claim of "Docker container UP" did not hold when re-checked (`Exited(143)`); HTTP behavior was independently re-verified against a running instance and matched the original claims (307/401). Full clean-build re-verification below. |

---

## Detailed Log

### Phase 0 — Capability gate fixes
- `src/app/api/finance/credit-notes/route.ts`: POST now requires `finance.approve` (was `finance.manage`). Confirmed by reading the route directly:
  ```
  await requireCapability(ctx, 'finance.approve');
  ```
- `src/app/api/finance/fiscal-periods/close/route.ts`: originally changed to `finance.approve` as well — functionally blocked accountant (correct outcome) but conflated approving refunds/credit-notes with closing a fiscal period, an undisclosed deviation from the plan (which specified a dedicated `finance.close` capability).
- **Fix (`bce1960`)**: added `'finance.close': 'Clôturer une période fiscale'` to `PERMISSIONS` (granted automatically to `super_admin`/`school_admin` via `ALL_PERMISSIONS`, not to `accountant`); `fiscal-periods/close` now requires `finance.close` specifically.
- `npx tsc --noEmit`: exit 0, independently re-run.

### Phase 1 — Sidebar navigation
- Read `src/components/shared/sidebar.tsx` directly: `visibleSchoolNavItems` filters `schoolNavItems` by `item.href.includes('/dashboard/academics') || item.href.includes('/dashboard/settings')` when `userRole === 'accountant'`.
- This is a hardcoded role check, not tied to `permissions.ts`'s capability model, and client-side only (the real security boundary remains each API route's `requireCapability`). It achieves the stated visible goal correctly today.
- **Fix (`ec535c8`)**: added a `ponytail:` comment documenting this as a deliberate shortcut with its upgrade path (a generic `/api/me/permissions`-driven filter), so it reads as an intentional choice rather than an oversight for the next person who touches this file.

### Phase 2 — `cashier_sessions` schema
- Independently verified via `docker compose exec db psql -U schoolos -d schoolos -c "\d cashier_sessions"` — table exists in the live database with columns matching `Schema.ts` exactly: `id, tenant_id, cashier_id, opened_at, closed_at, starting_float, expected_cash, actual_cash, total_collected, status (cashier_session_status enum), notes, created_at`. FKs to `tenants` and `user` confirmed present.
- This is real — unlike an earlier, unrelated plan's first pass on a different feature in this same repo, the migration genuinely applied and the table genuinely exists, confirmed independently rather than trusted from a log line.

### Phase 3 — Accountant APIs
- 5 routes confirmed to exist: `/api/accountant/me/{home,cashier,approvals,receivables,office-accounting}`.
- `cashier/route.ts` read in full: GET computes `totalCollected`/`expectedCash` from a real query against `payments` (`receivedById` = current user, `paymentMethod = 'cash'`, `createdAt >= session.openedAt`), not a placeholder. POST blocks opening a second session with a 409. PUT closes the session, recomputes the same real total, and records `actualCash` for variance. This is genuine, correct logic.
- `accountant@atlas.ma` / `accountant@schoolos.ma` confirmed present in `src/scripts/seed.ts`.

### Phase 4 — Portal UI pages
- All 6 page files read directly, every `fetch(...)` call inspected for the specific failure pattern seen on an earlier, unrelated plan in this repo (a hardcoded fallback number standing in for real data, e.g. `students.length || 20`): **none found** across `finance/page.tsx`, `receivables`, `approvals`, `office-accounting`. All fetch their real corresponding `/api/accountant/me/*` endpoint; mutations POST for real.
- `collection-desk/page.tsx` **did not** have this problem, but had a different one: its "Encaissement Rapide de Scolarité" search box had an input and a "Rechercher" button with no `onClick` handler at all — pure decoration. The cashier open/close flow was real; the actual collection-desk purpose (find a student, see their invoice, take payment) did not exist.
- **Fix (`ec535c8`)**: wired the search box to the real `/api/search` route, added student selection, added a `?studentId=` filter to `GET /api/finance/invoices` (additive, existing callers unaffected — verified no other caller passes `studentId` today so this can't change any existing response), shows each outstanding invoice (`netAmount - paidAmount > 0`), and a collect-payment modal that POSTs to the existing `/api/finance/payments` (reused, not duplicated, so GL auto-post/cents-math stays in one place). On success, shows a print-friendly receipt and refreshes both that student's remaining invoices and the cashier session's running total (recomputed server-side, not tracked client-side). Collection is disabled with a visible prompt when no cashier session is open.
- `npx tsc --noEmit`: exit 0 after this change, independently re-run.

### Phase 5 — Build / HTTP verification
- On re-check, `schoolos-app` was `Exited (143)` (stopped, not crashed) and `migrate`'s last recorded run was `Exited (1)` — stale from the original execution's own troubleshooting, not a current failure, but not something that should have been left as the final state given the report claimed the container was "UP."
- HTTP behavior was independently re-verified against a still-running process on port 3000 and matched the original claims exactly: all 6 dashboard pages → 307 (redirect to login), all 5 `/api/accountant/me/*` routes → 401 (unauthorized).
- This pass redoes the verification from a genuinely clean state — see the run below.

---

## Clean-state re-verification (this pass)

1. **`docker compose build migrate`** — rebuilt from scratch, exit 0.
2. **`docker compose run migrate`** — hit a transient Docker daemon issue mid-run (`request returned 500 Internal Server Error` from the Docker API), recovered after ~20s once the daemon responded to `docker info` again. A subsequent invocation exited 1 without a printed error (spinner output never resolved) — investigated directly against Postgres rather than retried blindly:
   - `SELECT * FROM pg_stat_activity WHERE state != 'idle'` — no blocking queries, nothing held up.
   - `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 5` — most recent entries correspond to the latest migrations, confirming the ledger is current.
   - `\d cashier_sessions` — table present with the exact shape `Schema.ts` defines.
   - `migrations/meta/_journal.json` tail confirms `0054_add_cashier_sessions` is the last, correctly sequential entry (`idx: 53`), no numbering collision with `0053_waitlist_leads` (added by the other concurrent session in the interim).
   - Conclusion: the migration itself is genuinely applied and correct; the CLI re-run's non-zero exit is an environment/tooling flake (likely downstream of the same Docker daemon hiccup), not evidence of a broken or reverted migration. Flagged for awareness, not treated as a blocker.
3. **`docker compose build app`** — rebuilt from scratch with every change from this pass (Collection Desk, capability fixes, sidebar), exit 0.
4. **`docker compose up -d --no-deps app`** — container started clean, confirmed `Up` via `docker compose ps` (not assumed).
5. **Real HTTP sweep**, freshly run, all matching expected auth-gated behavior:

   | Route | Method | Expected (unauthenticated) | Actual |
   |---|---|---|---|
   | `/fr/dashboard/finance` | GET | 307 | 307 |
   | `/fr/dashboard/finance/collection-desk` | GET | 307 | 307 |
   | `/fr/dashboard/finance/receivables` | GET | 307 | 307 |
   | `/fr/dashboard/finance/office-accounting` | GET | 307 | 307 |
   | `/fr/dashboard/finance/approvals` | GET | 307 | 307 |
   | `/fr/dashboard/finance/reports` | GET | 307 | 307 |
   | `/api/accountant/me/home` | GET | 401 | 401 |
   | `/api/accountant/me/cashier` | GET | 401 | 401 |
   | `/api/accountant/me/approvals` | GET | 401 | 401 |
   | `/api/accountant/me/receivables` | GET | 401 | 401 |
   | `/api/accountant/me/office-accounting` | GET | 401 | 401 |
   | `/api/finance/credit-notes` (Phase 0 fix) | POST | 401 | 401 |
   | `/api/finance/fiscal-periods/close` (Phase 0 fix) | POST | 401 | 401 |

6. **`docker compose logs app --tail 40`** grepped for `Failed to compile|Module not found|error TS` — no matches.

### What this does and does not prove
This confirms every route compiles, deploys, and enforces authentication correctly from a genuinely clean build. It does **not** prove the authenticated business logic is correct end-to-end (e.g. that collecting a payment through the Collection Desk UI actually updates an invoice's balance) — that requires a real logged-in session, which wasn't performed this pass. Recommended next check before considering this fully done: log in as `accountant@schoolos.ma`, open a cashier session, search a real student, collect a real payment, and confirm the invoice balance and cashier total both change correctly in the database.

## Outstanding (not fixed this pass)
- Sidebar filtering remains a hardcoded role check by deliberate choice (documented, not a defect) — upgrade to capability-driven only if a second role needs the same treatment.
- No automated test suite was added for any of this (cashier session math, capability gates, Collection Desk flow) — everything above is manual/scripted verification, not regression-protected.
