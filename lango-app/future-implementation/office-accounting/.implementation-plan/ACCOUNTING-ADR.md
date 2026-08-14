# ADR: Office Accounting Ledger Evolution

## Decision

Extend the existing `chart_of_accounts`, `fiscal_periods`, `journal_entries`, and `journal_entry_lines` ledger. Do not create a parallel general ledger.

V1 uses MAD as base currency and exact two-decimal postings. Operational modules submit versioned, payload-bound posting requests. The accounting service owns period validation, account validation, transactional numbering, balanced journal creation, immutable events, idempotent outcome reuse, and reversals.

## Invariants

- Every posted entry has at least two one-sided positive lines and exact debit/credit equality.
- A posting date belongs to one open tenant period.
- Accounts, journals, voucher types, entries and lines are tenant-consistent.
- A tenant/source/version/idempotency key identifies one canonical payload and one outcome.
- Reusing a key with a changed payload fails.
- Posted lines never change; corrections use an equal-and-opposite linked entry.
- Number allocation is serialized per tenant/journal/fiscal year.
- Missing mappings/periods are explicit exceptions, never silent skips.

## Workflow boundary

Manual source documents may use prepare/approve controls outside the immutable journal. The journal is written only at final posting. High-risk manual vouchers require a distinct approver. Existing operational source tables remain authoritative for their workflows and retain the returned journal reference through the posting-request contract.

## Compliance boundary

Morocco-oriented codes and mappings are configurable examples only until reviewed by a qualified local accountant. The system must not label them legally certified.
