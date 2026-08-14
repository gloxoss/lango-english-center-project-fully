# Office Accounting Manual Testing

> Gate update 2026-08-09: full TypeScript and the isolated production Docker build pass. Remaining release work is the human Arabic/RTL and exploratory browser checklist.

## Prerequisites

- Apply migrations `0085`, `0089`, `0090`, `0093`, `0097`, `0098`, `0103` (each is idempotent).
- Sign in as an accountant or school administrator.
- Create an open fiscal period covering the test date and at least two active accounts.
- Under **Journaux & pièces**, create the required journal and source-bound voucher types. Never use the verification-only `VERIFY` type for real data.

## Browser route sweep

1. Open `/dashboard/finance/accounting/accounts`; create an account and verify the hierarchy/search. Select an unused zero-balance leaf with Enter/Space and archive it. A repeat is a safe no-op. An active parent must return `409 ACCOUNT_HAS_ACTIVE_CHILDREN`; a non-zero account must return `409 ACCOUNT_NON_ZERO_BALANCE`.
2. Open `/dashboard/finance/accounting/voucher-types`; create a journal and a voucher type.
3. Open `/dashboard/finance/accounting/deposits/new`; post an encaissement and record its voucher number.
4. Open `/dashboard/finance/expenses/new`; create an expense draft.
5. Open `/dashboard/finance/accounting/expenses`; submit the draft.
6. Confirm the creator cannot approve their own submitted expense.
7. Sign in as a different authorized accountant/admin, approve it, then post it using the configured journal/type.
8. Open `/dashboard/finance/accounting/transactions`; find both vouchers and confirm debit equals credit.

### Student Accounting (`/dashboard/finance/accounting/student-accounting`)

9. In **Mappings**, create a fee-category → revenue account mapping (leave the key empty for the default).
10. Post a student invoice with a mapped category: the reconciliation tab must show it **Comptabilisé**.
11. Post an invoice for an **unmapped** category: it must appear **Bloqué** with an open exception (never a guessed account).
12. From the **Exceptions** tab, add the missing mapping, then re-post: the exception auto-resolves and the reconciliation flips to **Comptabilisé**.
13. Record a payment: reconciliation shows Dr banque = Cr créance and the totals stay balanced.

### Statements (`/dashboard/finance/accounting/statements`)

14. Switch between Balance générale / Grand livre / Compte de résultat / Bilan / Flux de trésorerie; adjust the period and refresh.
15. Balance générale must display **ÉQUILIBRÉ** (débit = crédit). Bilan must balance (actif = passif + capitaux propres + résultat).
16. Click an account row to open the drill-through; verify the running balance and the back link.
17. Download the CSV for each type; the file must open with the expected columns and quoting.

### Periods (`/dashboard/finance/accounting/periods`)

18. Create a period, then close it (mandatory reason). The row shows **Clôturée**.
19. Request a reopen with a detailed reason (≥ 10 chars): a **pending** request appears.
20. As the **same** actor, try to approve: the server must reject (maker-checker).
21. Sign in as a different authorized actor, approve: the period returns to **Ouverte**.
22. (Optional) Re-close and reject a request instead: the request is recorded **rejected** and the period stays closed.

### Bank/Cash reconciliation (`/dashboard/finance/bank-reconciliation`)

23. Create a reconciliation (date + balances). Click the row to open the lifecycle workspace.
24. **Import** a CSV with header `date, description, debit, credit` (reference optional): lines appear with **Non rapproché** status. Import the same file again: the UI shows "déjà importé".
25. Pick the **bank asset account**, then select one statement line + one journal line and **Rapprocher la sélection**: the line flips to **Rapproché** and the reconciled balance accumulates.
26. Select a statement line and **Découper** it across ≥ 2 journal lines with amounts: it becomes **Partiel** (or **Rapproché** when fully covered).
27. Check ≥ 2 statement lines, select one journal line, **Fusionner**: the lines collapse onto that one journal line.
28. **Correspondances**: each pair shows the matched amount; use **Annuler** to unmatch.
29. **Frais & intérêts**: post a fee (offset = charge account) and an interest (offset = produit account); verify the balanced voucher appears in the GL and the events log records it.
30. **Clôture**: if balanced, close without a reason; if there is an unexplained variance, closing without a reason is blocked (motif required). After close the row shows **Clôturé** and every statement artifact is read-only.

## Adversarial checks

- Re-submit the same deposit payload: the same idempotency key must return the original voucher, not add another.
- Reuse that key with a changed amount: expect `409 POSTING_REQUEST_CONFLICT`.
- Use an account ID from another tenant: expect `422 INVALID_ACCOUNT` without revealing foreign data.
- Post into a closed/out-of-range period: expect `409 FISCAL_PERIOD_CLOSED`.
- Create the same expense supplier/reference twice: the second request must fail with 409.
- Race six identical posting requests: exactly one journal entry and two lines must exist.
- Attempt to update a posted document or an event directly in SQL: PostgreSQL must reject it.
- Reverse a voucher twice: the second reversal must fail because one original entry has only one reversal link.
- Delete or change the type of an account that has posted lines: blocked (0093).
- Close a period with approved-but-unposted documents or a draft reconciliation: blocked with an explicit reason.
- Import the same reconciliation CSV twice: the second import returns `alreadyImported`.
- Close a reconciliation with unmatched/partial lines: blocked; after close, editing any statement artifact is rejected at the DB layer.

## Automated evidence

```powershell
npx tsx scripts/migrate-0085-office-accounting.ts
npx tsx scripts/check-0085-office-accounting.ts
npx tsx scripts/migrate-0089-office-accounting.ts
npx tsx scripts/migrate-0090-office-accounting.ts
npx tsx scripts/test-office-accounting-posting.ts
npx tsx scripts/test-office-accounting-workflow.ts
npx tsx scripts/verify-accounting-0093.mjs
npx tsx scripts/verify-accounting-0097.mjs
npx tsx scripts/verify-accounting-0098.mjs
npx tsx scripts/verify-accounting-0103.mjs
npx tsx scripts/verify-accounting-reports.mjs
npx tsx scripts/verify-accounting-reversal-concurrency.mjs
npx tsx scripts/typecheck-office-accounting.mjs
```

Expected: migrations apply idempotently; posting 7/7; workflow 9/9 (the workflow suite counterposts its live verification expenses and voids abandoned drafts so the net ledger impact is zero); 0093 20/20; 0097 33/33; 0098 51/51; 0103 9/9; reports 16/16; reversal-concurrency 21/21; scoped tsc 62 roots PASS.

## Arabic, responsive and accessibility sweep

1. Repeat the route sweep under `/ar/dashboard/finance/accounting/...`; confirm `lang="ar" dir="rtl"`, Arabic primary headings/actions, logical search/table alignment, and readable hierarchy.
2. At 390px and 768px, verify forms stack, tables scroll inside cards, dialogs stay in the viewport, and no page-level horizontal overflow appears.
3. Navigate without a mouse: focus is visible; account rows select with Enter/Space; forms/archive are reachable; status/errors are announced.
4. Ask a fluent Arabic reviewer to validate accounting terminology. This does not certify Morocco chart/tax/statutory mappings.

## Remaining human acceptance

- Authenticated exploratory browser sweep and 390px visual review.
- Fluent-Arabic terminology review.
- Qualified Moroccan professional approval of chart/tax/statutory mappings. Payroll posting remains Payroll-owned and is not an Office Accounting implementation gap.
