# Library Management Add-on — Manual Testing Guide

Companion to `VERIFICATION-EVIDENCE.md`. This guide covers **human/browser** verification of the
library add-on against the live app. Automated evidence (32 vitest tests, migration reruns, tsc,
`next build`, tenant-isolation scan) is in `VERIFICATION-EVIDENCE.md`.

Prereqs: `next dev` running, add-on `library` enabled for the tenant, a `librarian` (or
`school_admin`) user signed in, and a student user for self-service.

## 0. Sign-off checklist (mark as you pass each flow)

| Flow | Status | Notes |
|---|---|---|
| Catalog CRUD + duplicate rejection | ☐ | |
| Copy creation + accession/barcode uniqueness | ☐ | |
| Member lookup (allowlisted fields) | ☐ | |
| Issue / renew / return | ☐ | |
| Double-loan prevention | ☐ | |
| Holds queue + hold-blocked issue | ☐ | |
| Overdue fine + waiver | ☐ | |
| Transfer lifecycle | ☐ | |
| Stocktake close immutability | ☐ | |
| CSV import (dry-run + commit) / export parity | ☐ | |
| Charge → Accounting posting | ☐ | |
| Member self-service isolation | ☐ | |
| Parent view gating | ☐ | |
| Add-on disable → 403, identity preserved | ☐ | |
| Permission denial (403) per capability | ☐ | |
| Direct-URL protection | ☐ | |
| French / English + RTL (Arabic) | ☐ | |
| Keyboard-first barcode desk | ☐ | |
| 390 px responsive flow | ☐ | |

## 1. Catalog & copies

1. **Create a record** — Catalog → New. Title, language, publication year. Save → row appears.
2. **Duplicate ISBN rejection** — add an edition with an ISBN already in use → 409 `DUPLICATE_ISBN`.
3. **Copy creation** — add a copy with accession `A-001` + barcode `BC-001`, pick branch/location.
   Add a second copy reusing `BC-001` → 409 `DUPLICATE_BARCODE`.
4. **Record detail** — open the record → editions, copies, contributors, subjects all render.
5. **Soft delete** — delete a record with **no** copies → disappears (soft). A record with copies →
   blocked with an explanation.

## 2. Members & lookup

1. Create a member from an existing tenant user → projected, no duplicate identity.
2. Search by name/member number → returns id, member number, branch, state, name/email/role only
   (**never** grades, finance, HR, medical, guardian directory).
3. Search with a query shorter than the min length → 422 validation error.

## 3. Circulation desk

1. **Issue** — scan member barcode then copy barcode (or type). Loan created; copy state
   `checked_out`; due date respects the policy's `loanDurationDays` and skips closed days.
2. **Double-loan prevention** — re-scan the same copy → error; the copy has exactly one active loan.
3. **Loan-limit / blocked member** — a member at `maxLoans` or blocked → issue refused.
4. **Renew** — renew an active loan → `renewedCount` increments; renew past `renewalLimit` or when a
   hold waits → refused.
5. **Return** — scan the copy → loan closed, copy back to `available`, or to `on_hold_shelf` if the
   next FIFO hold exists. **Re-scan the same copy** → idempotent (no duplicate charge/event).
6. **Holds** — place a hold on a checked-out copy; return it → copy goes to `on_hold_shelf`, hold
   becomes ready; issuing it to anyone else is blocked.

## 4. Charges & accounting posting

1. Overdue a loan (or mark lost/damaged) → an open `library_charges` row appears for the member.
2. **Waive** with a required reason (`library.charge.waive`) → charge `waived`.
3. **Post to accounting** — with member + reason account mappings configured, POST
   `charges/[id]/post` → a balanced 2-line journal voucher (debit receivable / credit revenue).
   Re-post → idempotent (same entry).
4. **Missing mapping** → the post is **blocked** with an actionable exception
   (`MAPPING_MEMBER_RECEIVABLE_MISSING` / `MAPPING_CHARGE_REASON_MISSING`); a durable
   `accounting_adapter_exceptions` row is written; **no journal entry** is created.
5. A non-open (waived/paid) charge → `CHARGE_NOT_OPEN`.

## 5. Transfers & stocktake

1. **Transfer** — request a copy transfer to another branch → `requested`; dispatch → `in_transit`;
   receive → `available` at the new branch.
2. **Stocktake** — open a count session; add observations (found / missing); close → adjustments
   reconcile the copy states; **a closed stocktake cannot be reopened or edited** (immutability).

## 6. CSV import / export

1. **Export** — Copies → Export. Download a CSV with the exact header template; a formula cell
   (`=SUM(...)`) is prefixed so spreadsheets treat it as text.
2. **Dry-run** — import a CSV → preview shows the exact rows/actions without writing.
3. **Commit** — confirm → new copies appear; re-importing the same file reports `replayed` (no-op).
4. **Malformed / oversized** — bad headers, bad edition references, or a file above the row/field
   cap → clean per-row errors, nothing written.
5. **Round-trip** — export, then re-import the export → zero changes (parity).

## 7. Self-service & parent view

1. As a **student**, open the library self-service → own loans/history/holds/charges only.
2. Try passing a different `memberId` in the request → the API derives the member from the session;
   no arbitrary member lookup.
3. As a **parent**, see a child's loans **only** when an active guardian relationship exists **and**
   explicit library rights are granted for that child; otherwise no data (default deny).

## 8. Security & permissions

1. **Add-on disable** — disable `library` for the tenant → every library route returns
   `403 ADDON_NOT_ACTIVATED`; the librarian **account is not deleted** — re-enable and it works.
2. **Capability 403** — a librarian (no `library.charge.waive`) waiving a charge → 403; a
   `student`/`teacher` hitting staff routes → 403.
3. **Cross-tenant** — switch to a second tenant → zero library rows from the first tenant appear
   (queries filtered by `tenantId`).
4. **Direct URL** — hit `/dashboard/library/catalog` while signed in without `library.catalog.read`
   → permission-denied state, never mock data.

## 9. Localization, keyboard & responsive

1. Switch UI to **French** and **English** → labels/errors render correctly.
2. **Arabic/RTL** → layout flips correctly with no broken controls.
3. **Keyboard-first** — drive issue/renew/return with only the keyboard (scan + Enter).
4. **390 px viewport** — desk and catalog flows remain usable (no horizontal scroll, touch targets
   reachable).

## 10. Cleanup / reset

After manual testing: the vitest suites create and delete their own tenants. Orphaned accounting
test tenants can be removed with `node scripts/cleanup-accounting-test-tenants.mjs` (disables the
ledger triggers, deletes in dependency order, re-enables).

## 11. Automated vs pending-manual

Everything in `VERIFICATION-EVIDENCE.md` §2 (32 tests) is automated and green. The rows above that
require a real browser are the sign-off checklist in §0 — none are blocking the automated
completion gate, but each should be exercised before the merge verdict is called "verified".
