# Role Portals, Accounting, and Workforce Wave

## Goal

Deliver the shared role-portal foundation, Office Accounting, Parent/Guardian Portal, Receptionist Portal, and Payroll & Workforce Operations without duplicating the repository's existing HR, Finance, CRM, Guard, student/guardian, or self-service domains.

## Execution order

1. **Baseline and decisions:** inventory the real schemas/routes/pages/tests and classify each specification item as reuse, extend, replace, or new. Record Office Accounting decisions (currency, accounting basis, approval/numbering policy) and Payroll decisions (HR dependency, pay frequency, launch contracts/components, cash/bank, statutory scope). Payroll rates and statutory exports remain non-production until professionally validated.
2. **Role Portals Foundation:** implement server-owned active-role context, capabilities and relationship scopes; `/api/portal/me`, manifest, home, search, activity and preferences; shared responsive shell; deny-by-default page/API guards. Preserve existing roles and establish the contracts all role portals consume.
3. **Office Accounting core:** consolidate the existing Finance ledger around versioned chart of accounts, periods, immutable balanced journals, transactional numbering, idempotent posting/reversal, maker-checker approval, deposits/expenses, reconciliation, statements and audit. Do not create another ledger or retain deletable posted expenses.
4. **Parent/Guardian Portal:** build on the portal context and authoritative effective guardian-student relationships. Deliver household/child switching, published academics, attendance/excuses, scoped finance, meetings/messages, requests/documents/consents and preferences with immediate revocation and custody restrictions.
5. **Receptionist Portal:** build a least-privilege front-desk workspace using CRM inquiries, admissions handoff, masked people lookup, appointments, Guard visitor/pickup workflows, approved communications and handoff tickets. Cashier/Finance access requires a separate explicit assignment.
6. **Payroll & Workforce foundation:** extend HR employee identities and the existing payroll/leave surfaces with addon dependency enforcement, effective-dated settings/rule packs, protected payroll profiles, components, structures, assignments, adjustments and a deterministic traceable calculation engine. Use legally reviewed fixtures before any production calculation claim.
7. **Payroll operations:** add immutable runs/results/payslips, maker-checker approval, Office Accounting posting contract, payment batches/reconciliation, leave transaction ledger, salary-advance ledger, awards and employee self-service. Posted results reverse/replace; balances never rely on mutable counters alone.
8. **Cross-domain integration:** connect Parent finance to authoritative student accounting; Reception to CRM/Guard; Payroll to HR and Office Accounting through versioned adapters and idempotency keys. Test addon-disabled and dependency-unavailable behavior without corrupting retained data.
9. **Verification and release:** apply and rerun migrations against PostgreSQL; run focused/unit/property/concurrency tests, `npx tsc --noEmit`, `npx next build`, tenant-isolation analysis and Docker build/start. Capture authenticated live HTTP/browser evidence plus two-tenant, cross-child, field-redaction, role-switch, balanced-posting, numbering-race, payroll-idempotency and double-payment adversarial results.

## Agent ownership and gates

| Workstream | Exclusive ownership | Cannot pass until |
|---|---|---|
| Foundation | portal context, manifest APIs, shared shell and portal authorization primitives | stale-role/context, manifest/API agreement, accessibility, RTL and negative authorization tests pass |
| Office Accounting | `src/features/finance/**` accounting core and `/api/finance/**` ledger contracts | balanced/idempotent posting, closed-period, reversal, numbering-race and reconciliation tests pass |
| Parent/Guardian | parent portal feature/API paths and relationship-scoped adapters | Foundation contract is stable; cross-child/custody/revocation tests pass |
| Receptionist | receptionist feature/API paths and CRM/Guard adapters | Foundation contract is stable; enumeration, pickup-authority and no-Finance tests pass |
| Payroll/Workforce | workforce/payroll feature/API paths and HR/accounting adapters | HR identity is stable; Office posting contract is stable before posting/payment phases; golden cases are professionally approved before production use |

## Shared-file protocol

`src/models/Schema.ts`, `migrations/meta/_journal.json`, permissions, portal manifest, sidebar, addon registry, middleware and package files have one integration owner at a time. Feature agents first implement inside their owned paths, then submit exact shared-file deltas. Inspect `git status --short` before every shared edit, preserve unrelated changes, and allocate migration numbers from the actual journal immediately before integration (the observed highest is `0082`, not a reservation).

## Release rule

No workstream may call itself complete from static code inspection or a page rendering alone. A claim of completion requires recorded commands, exit codes, database invariants, live authorization evidence and an explicit list of any browser, legal/compliance or external-integration checks still pending.
