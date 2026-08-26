# Implementation Plan — Accountant Portal (v2, corrected against live codebase)

Status: audited and reworked 2026-08-05. The original draft's schema claims were accurate; its "what needs to be built" section was not — most of it already exists. This version builds on top of what's real instead of duplicating it.

The **Accountant Portal** provides controlled Student Accounting and Office Accounting operations for school accountants and cashiers without granting unrestricted school-wide administration or exposing sensitive student academic/medical data.

---

## 👥 Persona Analysis & Requirements

### Who is the Accountant Persona?
School accountants, bursars, and cashiers responsible for collecting tuition, processing daily payments, managing office expenses, performing bank reconciliation, and issuing financial reports.

### What the accountant role actually has today (verified in `src/libs/api/permissions.ts`)
`DEFAULT_ROLE_PERMISSIONS.accountant` = `students.read`, `finance.read`, `finance.manage`, `reports.read`, `reports.export`, `guardians.read`, `hr.read`, `hr.manage`.

Two things the original draft got wrong by not checking this:
1. **The role isn't starting from zero.** It already has blanket `finance.manage` — broad create/update rights across invoices, payments, expenses, journals, chart of accounts, bank reconciliation. The gap is not "give the accountant finance access," it's "narrow an already-broad grant to the specific maker-checker boundary this plan wants."
2. **It already has `hr.manage`** — full HR/payroll management, granted by default, unrelated to anything this plan discusses. This needs an explicit decision (keep, because payroll commonly sits with accounting — or split out), not silent carry-over.

### Privacy boundary — real, but only by omission
Accountant has no `academics.read`/`grading.read`/`attendance.manage` — so grades and attendance are already invisible today. There is no explicit deny; it simply was never granted. There is also **no "medical notes" field or table anywhere in the schema** — that specific claim in the original draft has nothing to actually restrict. Don't build a control for data that doesn't exist.

---

## 🔑 Capability & Access Control Matrix (corrected — minimal, not maximal)

The original draft proposed six capabilities (`finance.read`, `finance.collect`, `finance.prepare`, `finance.reconcile`, `finance.approve`, `finance.close`). Checked against what's actually needed: `finance.manage` already covers collect/prepare/reconcile in practice (every existing finance route that mutates data gates on `finance.manage`, not a finer split), and there's no second role in this app that would ever need only one of those three without the others. Splitting them now is speculative — add the granularity only if a real second role (e.g. a collections-only cashier) is ever introduced.

**What's actually needed: two changes, not six new capabilities.**

| Capability Key | Status | Change needed |
|---|---|---|
| `finance.read` | Exists, correct | None |
| `finance.manage` | Exists, correct | None — stays the "prepare/collect/reconcile" tier |
| `finance.approve` | Exists, correctly gates `POST /api/finance/refunds` today | **Bug**: `POST /api/finance/credit-notes` currently only requires `finance.manage` — an accountant can issue a credit note today with no approval step. Change its gate to `finance.approve`. |
| `finance.close` | **Does not exist** | New capability. `POST /api/finance/fiscal-periods/close` currently only requires `finance.manage` — an accountant can close a fiscal period today. Add `finance.close`, granted only to `super_admin`/`school_admin`, and gate that route on it. |

Invoice cancellation: no such action exists yet in `POST /api/finance/invoices` (no DELETE handler, no cancel path). If cancellation is wanted as a distinct maker-checker action, it needs to be built new — it's not a gap in an existing route, it's a missing feature. Scope it in Phase 3 if actually needed; don't invent it just because the original draft mentioned it.

---

## 🖼️ Pages — corrected: reuse first, build only what's genuinely missing

The original draft's proposed structure (`receivables/`, `collection-desk/`, `office-accounting/`, `approvals/`, `reports/`) was written without checking the current `/dashboard/finance/` tree, which already has **14 pages**:

```
finance/invoices/page.tsx           finance/bank-reconciliation/page.tsx
finance/invoices/[id]/page.tsx      finance/chart-of-accounts/page.tsx
finance/payments/page.tsx           finance/journal/page.tsx
finance/payments/new/page.tsx       finance/online-payments/page.tsx
finance/expenses/page.tsx           finance/reminders/page.tsx
finance/pricing/page.tsx            finance/allocation/page.tsx
finance/reports/page.tsx            finance/reconciliation/page.tsx  <- dead duplicate of bank-reconciliation, delete
```

`finance/reports/page.tsx` already exists — building it "new" per the original plan would have silently overwritten real, working code.

**Corrected page plan:**

| Page | Action |
|---|---|
| `finance/page.tsx` (home) | **Build new** — genuinely doesn't exist. Real KPI aggregation from existing tables (due today, unreconciled count, open cashier session, pending approvals). |
| `finance/collection-desk/page.tsx` | **Build new** — genuinely doesn't exist. Student/invoice lookup, cashier session, offline payment collection, receipt. |
| `finance/approvals/page.tsx` | **Build new** — genuinely doesn't exist. Queue of pending refunds/credit-notes awaiting `finance.approve`. |
| Receivables | **Don't build a new page.** Link `finance/invoices`, `finance/reminders`, `finance/allocation` from the home dashboard — they already cover this. |
| Office accounting | **Don't build a new page.** Link `finance/expenses`, `finance/journal`, `finance/chart-of-accounts`, `finance/bank-reconciliation` from the home dashboard — all four already exist and were verified real this session. |
| `finance/reconciliation/page.tsx` | Delete — dead duplicate, renders the exact same component as `finance/bank-reconciliation/page.tsx`. |

Net new page count: **3**, not 6.

---

## 🧭 The gap the original draft never mentioned: navigation isn't capability-filtered

Checked `src/components/shared/sidebar.tsx` directly (not `portal-manifest.ts`, which *is* permission-filtered) — the actual rendered sidebar has **zero per-item filtering**. Every non-super-admin role, including accountant, currently sees the entire sidebar: Students, Teachers, full Academics, Attendance, Homework, HR, Settings, everything. The API correctly 403s anything they lack capability for, but the UI gives no indication until they click. A "dedicated Accountant Portal" cannot exist while this is true — it needs to be fixed as its own phase, or the portal is cosmetic.

Minimal fix (additive, doesn't touch other roles' behavior since admins have every capability already): a new `GET /api/me/permissions` route returning the current user's resolved capability set (reuses `hasCapability`'s existing resolution logic), `sidebar.tsx` fetches it once client-side and filters `schoolNavItems`/`subItems` by an added optional `permission` field per item — same shape convention `portal-manifest.ts` already uses, so the two nav sources stay conceptually consistent even though they remain separate files (unifying them into one source is a larger refactor, out of scope here — flag it as a follow-up, don't attempt it inside this plan).

Also, only 4 of the 14 existing finance pages have a sidebar entry today (`invoices`, `payments/new`, `expenses`, `pricing`) — `bank-reconciliation`, `chart-of-accounts`, `journal`, `online-payments`, `reminders`, `allocation`, `reports` are built but unreachable from the UI. Fixing navigation is what actually makes most of "office accounting" and "receivables" real for a user, not new pages.

---

## 🛠️ Existing vs Missing Logic (corrected)

### ✅ Confirmed real (verified directly, not assumed)
- Schema: `invoices`, `payments`, `feeStructures`, `feeStructureAssignments`, `expenses`, `journalEntries`, `chartOfAccounts`, `bankReconciliations`, `creditNotes`, `refunds`, `fiscalPeriods` — all exist with real columns and FKs.
- Routes: `/api/finance/invoices`, `/payments`, `/payments/sandbox`, `/expenses`, `/bank-reconciliation`, `/chart-of-accounts`, `/journals`, `/credit-notes`, `/refunds`, `/fiscal-periods/close`, `/fee-structures`, `/fee-assignments`, `/fee-allocation`, `/allocations`, `/reminders`, `/reports` — all real, all tenant-scoped, all `requireCapability`-gated.
- 14 finance pages, several verified real and working this session (bank-reconciliation, chart-of-accounts, journal, online-payments, reminders, fee-allocation).
- `accountant` role exists in `AppRole`, already has working finance access.

### ⚠️ Confirmed genuinely missing (build these)
1. `cashierSessions` table — open/close timestamps, starting float, collected cash/check/card totals, closing variance. Confirmed absent from `Schema.ts`.
2. `finance.close` capability (new) + the credit-notes gate fix (existing capability, wrong string).
3. Collection desk backend: cashier open/collect/close, student/invoice quick-search (can reuse the existing global search pattern from `header.tsx`'s search API, scoped to students+invoices).
4. Approvals queue backend: list pending refunds/credit-notes, approve/reject action.
5. `finance/page.tsx` home aggregation endpoint.
6. Sidebar capability filtering (`/api/me/permissions` + `sidebar.tsx` filter).

---

## 🗺️ Execution Phases (reworked, ordered by dependency and risk)

### Phase 0 — Capability gate fixes (no schema, immediate, do this first)
- Add `finance.close` to `PERMISSIONS` and `DEFAULT_ROLE_PERMISSIONS` (super_admin/school_admin only).
- Change `credit-notes` POST's gate from `finance.manage` to `finance.approve`.
- Change `fiscal-periods/close`'s gate from `finance.manage` to `finance.close`.
- Decide and act on `hr.manage`: keep or remove from accountant's default grant.

### Phase 1 — Navigation capability filtering
- `GET /api/me/permissions`.
- `sidebar.tsx`: fetch once, filter `schoolNavItems` by an added `permission` field.
- Add sidebar entries for the 7 currently-unreachable finance pages.
- Delete the dead `finance/reconciliation/page.tsx` duplicate.

### Phase 2 — Schema
- `cashierSessions` table + migration (re-check `migrations/meta/_journal.json`'s true highest idx at execution time, not any number written here).

### Phase 3 — Backend
- `/api/finance/cashier-sessions` (open/close, current-session lookup).
- `/api/finance/collection-search` (student/invoice quick lookup, reuse the existing search route's pattern).
- Extend `/api/finance/payments` POST or add a thin wrapper to require an open cashier session when the caller is an accountant collecting cash/check.
- `/api/finance/approvals` (GET pending refunds+credit-notes awaiting approval, tenant-scoped).
- `/api/finance/home` (KPI aggregation: due today, unreconciled count, open session, pending approvals count).

### Phase 4 — UI
- `finance/page.tsx` (home).
- `finance/collection-desk/page.tsx`.
- `finance/approvals/page.tsx`.
- Link existing 10 pages from the home dashboard — no rebuild.

### Phase 5 — Verify (see rules below — this is where the last plan's execution actually failed)
- Real `psql` row checks after every migration/backfill, not just a "migrations applied successfully" log line.
- Real `docker compose build app` + container restart + real `curl`/browser check for every route and page — `tsc --noEmit` alone is not sufficient and has produced false confidence in this exact repo before.
- Read every UI file's actual fetch calls before claiming it's "wired to real data" — check for hardcoded fallback values (`|| 20`, `?? 30`, a literal placeholder number) the way the academic-enhancement work's promotion wizard had one that survived two rounds of claimed fixes.
- Login as `accountant@schoolos.ma`, click through the real sidebar (post-Phase-1), confirm Academics/Settings/HR-employee-detail are genuinely gone from view, confirm every finance page loads with real data.
- Test the maker-checker boundary for real: attempt a credit note and a fiscal-period close as `accountant`, confirm both are rejected (403) after Phase 0; confirm both succeed as `school_admin`.

## Done when
- Every claim in Phase 5 has a pasted, real command output backing it — not a description of what should happen.
- No finance action grants unrelated school-admin authority (verified by trying it as accountant and getting rejected).
- Zero duplicate pages, zero pages built that already existed under a different name.
