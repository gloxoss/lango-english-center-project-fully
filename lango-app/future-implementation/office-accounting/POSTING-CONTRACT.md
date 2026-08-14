# Office Accounting — Versioned Posting Contract & Payroll Handoff (WA6)

**Contract version: `1.0`** — declared as `POSTING_CONTRACT_VERSION` in
`src/features/accounting/services/posting-service.ts`. Any breaking change to
`AccountingPostingInput` or `AccountingPostingResult` must bump this constant
and this document. This is an **in-process TypeScript contract** (no wire
schema): every source module calls `postAccountingVoucher(...)` in-process with
typed inputs and receives a typed result.

---

## 1. The posting function

```ts
import { postAccountingVoucher, POSTING_CONTRACT_VERSION } from '@/features/accounting/services/posting-service';
import type { AccountingPostingInput, AccountingPostingResult } from '@/features/accounting/services/posting-service';
```

`postAccountingVoucher(input: AccountingPostingInput): Promise<AccountingPostingResult>`

The service is the **only** path that writes `journal_entries`, lines, links and
events. It validates, locks, numbers and posts **atomically in one DB
transaction**. Source modules must never insert journal rows directly.

### `AccountingPostingInput`

| Field | Type | Rule |
|---|---|---|
| `tenantId` | `string` | must match the caller's tenant; every FK is tenant-composite |
| `actorId` | `string` | the human/actor requesting the posting (audited) |
| `entryDate` | `string` (`YYYY-MM-DD`) | must fall inside an **open** fiscal period (`FISCAL_PERIOD_CLOSED` otherwise) |
| `description` | `string` | free text; becomes the entry description |
| `sourceModule` | `string` | stable module slug, e.g. `student_invoice`, `payroll`. Must equal the voucher type's `source_module` when that type is module-scoped (`VOUCHER_SOURCE_MISMATCH` otherwise) |
| `sourceDocumentId` | `string` | caller's business-document id |
| `sourceVersion` | `number` | positive integer; the document's own version |
| `idempotencyKey` | `string` | **replay key** (see §2) |
| `journalCode` | `string` | active journal code (e.g. `GEN`) |
| `voucherTypeCode` | `string` | active voucher-type code (e.g. `INV`, `PAY`, `PAYE`) |
| `lines` | `AccountingPostingLine[]` | ≥2 lines, each exactly one positive side, exact debit=credit |
| `reversalOfEntryId?` | `string` | links a reversing entry to its original |
| `eventReason?` | `string` | reason recorded on the voucher event |

`AccountingPostingLine` = `{ accountId, debitAmount, creditAmount, memo? }`.
Amounts are money strings (`1234.56`); `moneyToCents`/`centsToMoney` never lose
precision. `normalizeLines` rejects single-line, both-sides or zero-amount lines
(`JOURNAL_LINES_REQUIRED`, `INVALID_JOURNAL_LINE`) and unbalanced totals
(`UNBALANCED_JOURNAL_ENTRY`) **before** anything is written.

### `AccountingPostingResult`

| Field | Type | Meaning |
|---|---|---|
| `postingRequestId` | `string \| null` | id of the `accounting_posting_requests` row (null only if a superseded link is missing) |
| `entryNumber` | `string` | deterministic journal number, e.g. `GEN-2098-000001` |
| `entry` | `journalEntries` row | camelCase fields incl. `sourceModule`, `entryDate`, `status:'posted'` |
| `lines` | `journalEntryLines[]` | the posted lines (full rows) |
| `totalDebit` / `totalCredit` | `string` | balanced totals |
| `idempotent` | `boolean` | `false` = fresh posting; `true` = replayed an identical prior request |

**Callers should persist `postingRequestId` and `entryNumber`** on their own
document so they can prove the exact ledger evidence for that source document
and support reverse-linkage.

---

## 2. Idempotency & source-version semantics (read carefully)

The service is a **replay-safe, content-addressed** posting pipeline:

- `idempotencyKey` is advisory-locked (`pg_advisory_xact_lock`). A concurrent
  identical request is serialized and returns the same entry.
- The full input is hashed (`sha256`, stable-key JSON). A request reusing the
  same `idempotencyKey` **or** the same `(sourceModule, sourceDocumentId,
  sourceVersion)` tuple with a **different** payload is rejected with
  `409 POSTING_REQUEST_CONFLICT` — a changed-payload replay must never silently
  create a second entry.
- Therefore a source module that re-posts the same business document must:
  1. keep `sourceVersion` stable across retries (bump it only when the document
     genuinely changes), and
  2. use a deterministic `idempotencyKey` derived from tenant + module + doc id.

The Student Accounting adapter does exactly this, e.g.
`student_invoice:${tenantId}:${invoiceId}` (see `student-accounting-adapter.ts`).

## 3. Account / voucher-type prerequisites

- Every `accountId` must be an **active** account in the same tenant
  (`INVALID_ACCOUNT` otherwise).
- `journalCode` + `voucherTypeCode` must resolve to an active journal/voucher
  type (`INVALID_VOUCHER_TYPE`). Numbering is per (journal, fiscal year),
  advisory-locked and deterministic.
- A voucher type with a non-null `source_module` is **reserved** for that
  module; other callers get `VOUCHER_SOURCE_MISMATCH`. Payroll should either
  use a module-agnostic type or create a `payroll`-scoped one.

---

## 4. Payroll handoff (how to wire Payroll → posting)

Payroll (`src/features/workforce/services/payroll-runs.ts`) currently documents
an accounting integration (`payroll-posting.ts` referenced in comments) that is
**not yet implemented**. When it lands, it must call `postAccountingVoucher` —
never insert journal rows. Baseline:

1. When a run transitions `approved → posted`, build one voucher per run (or per
   payslip batch) with:
   - `sourceModule: 'payroll'`, `sourceDocumentId: <run id>`,
     `sourceVersion: <run.calculationVersion>` (the engine already versions
     snapshots via `calculationSnapshot`/`calculationVersion`),
   - `idempotencyKey: payroll:${tenantId}:${runId}`,
   - `journalCode`/`voucherTypeCode` pointing at a payroll journal + voucher type
     (active; module-agnostic or `payroll`-scoped),
   - `entryDate` inside the run's pay period (open fiscal period).
2. Canonical employee-side journal per run (aggregating `payroll_run_lines`):
   - **Dr** `salary_expense` = Σ `gross_salary`
   - **Cr** `net_payable` = Σ `net_payable` (or `net_salary`)
   - **Cr** `cnss_employee_payable` = Σ `cnss_employee`
   - **Cr** `amo_employee_payable` = Σ `amo_employee`
   - **Cr** `ir_tax_payable` = Σ `ir_tax`
   - **Cr** other-deductions/recovery account = Σ (`net_salary − net_payable`)
   Because `net_salary = gross − cnss − amo − ir`, this balances exactly at the
   cent level when you use the run-line values consistently on both sides.
3. Employer side (Σ `cnss_employer`, Σ `amo_employer`) is a **second** expense
   voucher (Dr employer-contribution expense, Cr the payable) — it must not be
   mixed into the net-pay voucher unless the chart setup says otherwise.
4. Posting `postRun` must happen **inside** the run transition, freeze the lines
   (already done via `isFrozen`), and store `postingRequestId`/`entryNumber`
   against the run for provenance.

### ⚠️ Latent IR rounding drift (document, don't fix payroll)

`computeStatutory` (ma-regulation-adapter) computes
`irMonthly = divInt(irAnnual, 12)` with **half-up rounding**. For annual IR
amounts not divisible by 12, `Σ(12 × irMonthly) ≠ irAnnual` by a few cents per
employee per year. The monthly net-pay voucher still **balances** (net is the
residual), but the `ir_tax_payable` liability will drift from the statutory
annual IR. The Payroll posting implementation must:
- use the run-line `ir_tax` value for the payable line **and** the `net_salary`
  residual (never recompute IR from gross on the posting side), and
- reconcile annual IR to statutory filings separately (this is a cents-level
  adjustment, not a journal imbalance). Payroll-owned tables/workflow must not
  be modified by the accounting module.

### Reverse handoff

Reversal of a posted run should call `reverseAccountingVoucher` (or post with
`reversalOfEntryId`), which inverts the original lines and links one reversal to
one original. Reversal concurrency and the one-reversal-per-original invariant
are enforced at the DB layer.

---

## 5. Boundaries & non-certification

- "Never silently post to suspense": the posting service never guesses an
  account. A source module that cannot resolve an account must **block** and
  surface an exception (Student Accounting does this via
  `accounting_adapter_exceptions`). Payroll must adopt the same pattern rather
  than posting a guessed account.
- Morocco IR/CNSS/AMO rates and chart mappings are **not professionally
  certified**; a qualified local accountant must approve them before production
  use.
