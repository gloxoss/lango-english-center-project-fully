# Inventory Management — Verified Execution Plan

> Ground truth for the executing agent. Read the shared context, source spec and PLAN.md first.
> Binding decisions at the bottom govern every phase; do not silently deviate.
> Status: **planned 2026-08-08** — since implemented; see `INVENTORY-MANAGEMENT.md`
> top-of-file status and `future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md` (#25)
> for current, verified status. This document is kept as the historical execution plan.

## 1. Verified current-state inventory (Finance + billing integration points)

Live-verified against the real Postgres on 2026-08-08 (DB reachable via `docker compose up -d db`, migrations at `0075`/journal `idx 76`). Real tenant IDs: **Atlas** `ca40c88e-339c-4fea-b5c4-51d5c9cc0239`, **SchoolOS** `f62f31eb-1fc8-4102-9145-a5ce0bca989b` (the shared context doc's `c9177d8a…`/`17c1db51…` are **stale** — do not use them). Seeded users: `USR-001` (school_admin, Atlas), `USR-SCHOOLOS-001` (school_admin, SchoolOS), `USR-ACC-001` (accountant, Atlas), `STU-001…` (students, Atlas). Password `Admin123!`.

### 1.1 Finance schema (`src/models/Schema.ts` — real shapes, not assumptions)

| Table | Line | Shape that matters to inventory |
|---|---|---|
| `expenses` | 1544 | `tenantId`, `category` (enum `salary/rent/utilities/supplies/marketing/other`), `amount` numeric(14,2) `mode:'number'`, `expenseDate`, `description`, `receiptUrl`, `recordedById`. No payment-status columns. |
| `invoiceItems` | 1775 | `tenantId`, `invoiceId`, `feeCategoryId` (nullable), `description`, `amount` numeric(14,2). **No qty/price columns** — a line is a description+amount total. **No route in the app writes invoiceItems today** (invoice detail GET at `invoices/route.ts:43` reads them; `allocations/route.ts:74` reads them). Inventory becomes the first writer. |
| `invoices` | 1800 | `tenantId`, `studentId` **NOT NULL → `user.id` ON DELETE CASCADE**, `feeStructureId` nullable, `invoiceNumber` varchar(50), `amount`, `discountAmount`, `netAmount`, `paidAmount`, `status` enum `pending/partial/paid/overdue/cancelled`, `dueDate`, `issueDate`, `note`. |
| `namingSeries` | 1834 | `prefix` PK, `tenantId`, `currentVal` — the tenant-scoped sequence used by `reserveVerificationCode` / `reserveEmployeeId`. |
| `payments` | 1846 | `tenantId`, `invoiceId` **NOT NULL**, `studentId` **NOT NULL**, `amount`, `paymentMethod` enum `cash/card/transfer/check`, `paymentDate`, `referenceId`, `receivedById`. |
| `paymentAllocations` | 3281 | `tenantId`, `paymentId`, `invoiceId`, `invoiceItemId` (nullable), `allocatedAmount`. |
| `creditNotes` | 3309 | `studentId`, `invoiceId` nullable, `creditNoteNumber`, `amount`, maker-checker status (`discountApprovalStatus`). |
| `cashierSessions` | 3938 | Open/close drawer with `expectedCash`/`actualCash`. Enforcement currently only for `accountant`+`cash` in the finance payment route. |
| `role` enum | 27 | `super_admin, school_admin, teacher, accountant, student, alumni, parent, receptionist, guard`. |
| `user` | 476 | `id` text (`STU-…`/`USR-…`), `tenantId`, `role`, `name`, `email`, `phone`, `branchId`, `userStatus`. |

### 1.2 Finance route contracts (exact behavior to mirror or call)

- **`POST /api/finance/invoices`** (`finance/invoices/route.ts:147`) — roles `school_admin/accountant`, capability `finance.manage`. Verifies `studentId` belongs to tenant (`WHERE id=? AND tenantId=?`), computes `netAmount = amount - discount`, generates `invoiceNumber = INV-{year}-{4 random digits}` (random, **not** `namingSeries`, not unique-constrained), inserts `invoices` only (no items). Errors: `422` unknown student, `23505→409`.
- **`POST /api/finance/payments`** (`finance/payments/route.ts:50`) — the canonical payment engine. Inside `db.transaction`: `SELECT pg_advisory_xact_lock(hashtextextended('{tenantId}:{invoiceId}',0))`; re-reads invoice tenant-scoped; balance check `paid ≤ net` else `409 PAYMENT_EXCEEDS_BALANCE`; inserts `payments` + `paymentAllocations`; recomputes `paidAmount` and `status` (`paid` iff `paid==net` else `partial`) in cents via `@/libs/finance/money` (`moneyToCents`/`centsToMoney`, BigInt). Accountant+cash requires an open `cashierSessions` row. After commit: `recordAudit` + fail-open GL via `tryPostPaymentGLEntry` (`@/libs/finance/gl-auto-post`).
- **`POST /api/finance/expenses`** (`finance/expenses/route.ts:36`) — capability `finance.manage`; inserts `expenses`, `recordAudit`, fail-open GL via `tryPostExpenseGLEntry`.
- **Billing history read path** — `/api/finance/statements?studentId&startDate&endDate` (capability `finance.read`) computes opening balance from `invoices` before `startDate` + period `invoices`/`payments`; `/api/finance/invoices?studentId=` lists by student. **A student sale that inserts a real `invoices`/`payments` row automatically appears in both — no inventory-side read-path work needed.**
- **Money/GL helpers (reuse, do not duplicate):** `@/libs/finance/money` (`moneyToCents`/`centsToMoney`/`normalizeMoney`), `@/libs/finance/gl-auto-post` (`tryPostPaymentGLEntry`, `tryPostExpenseGLEntry`, `tryPostRefundGLEntry`), `@/libs/services/finance-ledger` (`postBalancedJournal`). All fail-open (skip when CoA/fiscal-period not configured).

### 1.3 Add-on / permissions / audit / sequence infrastructure (verified)

- **Registry** (`src/addons/registry.ts:55`) — `{ id:'inventory', name:'Inventory Management', description:'…Not built.', enabled:false }` already present. Route gate chain (events precedent): `requireRequestContext` → `requireTenant` → `requireAddon(tenantId,'inventory')` → `requireCapability`.
- **Entitlements** (`addonEntitlements`, `src/libs/api/entitlements.ts`) — `requireAddon`/`hasAddon`/`assertKnownAddon`; school_admin can only toggle existing rows (`settings/addons/[id]` PATCH), a new grant needs super-admin. **Dev activation = insert `addonEntitlements` rows for both tenants directly (events precedent).**
- **Permissions** (`src/libs/api/permissions.ts`) — `PERMISSIONS` const is the source of truth; `ALL_PERMISSIONS = Object.keys(PERMISSIONS)` so `super_admin`/`school_admin` get any new key automatically. `accountant` is deliberately finance-only (no `hr.*`); `receptionist` has front-desk keys. No `inventory.*` keys exist yet.
- **Audit** (`src/libs/api/audit.ts`) — `recordAudit(ctx, action, entityType, entityId, metadata?)` fire-and-forget; `action` is a fixed union (`create/update/delete/login/logout/export/import/settings_change/permission_change/entitlement_change`). `archive` models as `update` + `{archived:true}`.
- **Concurrency-safe tenant sequence** — `src/libs/services/alumni-verification-code.ts` `reserveVerificationCode` (`pg_advisory_xact_lock(hashtextextended('{tenant}:{prefix}',0))` + `namingSeries` bump, **must run inside an open `tx`**). Copy this shape for inventory reference numbers.
- **Migration journal** — highest `0075_hr_profile_national_id_salary.sql`, journal last entry `{tag:"0075…", idx:76, when:1786500000000}`. **Next migration = `0076`, next idx = `77`, `when` must be > 1786500000000.**
- **Shared files already dirty** (verified `git status --short`): `migrations/meta/_journal.json`, `src/models/Schema.ts`, `src/libs/api/permissions.ts`, `src/addons/registry.ts`, `src/components/shared/sidebar.tsx`, `package.json`, `package-lock.json` — all modified by prior/parallel work. Inventory must follow the collision protocol (§17.1) before editing them.
- **Isolation static check** — `scripts/check-tenant-isolation.ts` has a known baseline of 3 pre-existing flags (promotions, migration/tasks/[id], migration/template). Every new inventory route must reference `tenantId`; any NEW flag is a real bug.

### 1.4 Reference-number & quantity idioms (verified)

- Tenant-scoped reference numbers: `namingSeries` + advisory lock (`reserveVerificationCode`). Use for `PUR-`/`SAL-`/`ISS-`/`ADJ-`/`TRF-{year}-######`.
- Money: **cents (BigInt) only**, never float (`@/libs/finance/money`). Inventory line totals must be computed server-side in cents.
- Existing invoice number style is `INV-{year}-{4 digits}` (random, not unique) — reuse this format for student-sale invoices to avoid surprising finance tooling (collision harmless; no unique constraint).

---

## 2. Complete inventory domain model and relationships

New file `src/features/inventory/models/inventory-schema.ts` (feature-schema pattern from `hr-schema.ts`: import shared types from `@/models/Schema`, lazy FK callbacks, barrel-re-exported by `Schema.ts`). All tables carry `tenantId` + `createdAt`/`updatedAt`; tenant scoping enforced at the query layer.

**Master data**
- `inventoryCategories` — `id`, `tenantId`, `name` (varchar 120), `description`, `status` (`active/archived`). `unique(tenant_id, name)`.
- `inventoryUnits` — `id`, `tenantId`, `name` (`KG, Piece, Dozen, Unit…`), `abbreviation`. `unique(tenant_id, name)`. Flat tenant list — **no generic unit-conversion table** (ratio lives per-product).
- `inventoryStores` — `id`, `tenantId`, `name`, `code`, `branchId` (nullable FK→`branches`), `mobile`, `address`, `description`, `status`. `unique(tenant_id, code)`. **Every tenant needs ≥1 store** (single-location case = one row; no "no store" special case).
- `inventorySuppliers` — `id`, `tenantId`, `name`, `companyName`, `address`, `contactName`, `phone`, `email`, `status`. `unique(tenant_id, name)`. Supplier→product list is **derived** from purchase lines (never stored).
- `inventoryProducts` — `id`, `tenantId`, `name`, `code` (varchar 40), `categoryId` FK→categories, `purchaseUnitId` FK→units, `saleUnitId` FK→units, `unitRatio` numeric (sale-units per purchase-unit, e.g. 12), `purchasePrice` numeric(14,2) string-mode, `salePrice` numeric(14,2), `remarks`, `isActive`. `unique(tenant_id, code)`. **No stock column** (§ binding decision). Sale-price-below-purchase is a soft warning, not a validation.

**Purchasing**
- `inventoryPurchases` — `id`, `tenantId`, `purchaseNumber` (`unique(tenant_id, purchase_number)`), `supplierId` FK, `storeId` FK, `status` enum (`ordered/received/reversed`), `orderDate`, `receivedAt`, `netAmount` numeric(14,2), `paidAmount` numeric(14,2), `paymentStatus` derived (`unpaid/partial/paid` from cents), `expenseId` nullable FK→`expenses`, `notes`, timestamps.
- `inventoryPurchaseLines` — `id`, `tenantId`, `purchaseId` FK, `productId` FK, `qtyInPurchaseUnit` numeric(14,3), `unitCost` numeric(14,2), `lineTotal` numeric(14,2) (server-computed).

**Sales**
- `inventorySales` — `id`, `tenantId`, `saleNumber` (`unique`), `storeId` FK, `saleToRole` enum (`student/staff/guest`), `studentId` nullable FK→`user.id` (required iff role=student), `customerName` (staff/guest), `saleDate`, `netAmount`, `paidAmount`, `paymentMethod` (reuse `paymentMethod` enum), `paymentReference`, `status` enum (`completed/reversed`), `invoiceId` nullable FK→`invoices` (student sales only), `recordedById`, `reversedById`, `reversedAt`, `reversalReason`, timestamps.
- `inventorySaleLines` — `id`, `tenantId`, `saleId` FK, `productId` FK, `qty` numeric(14,3) (sale/base units), `unitPrice` numeric(14,2), `lineTotal` numeric(14,2), `invoiceItemId` nullable FK→`invoiceItems` (student sales).

**Issues / loans**
- `inventoryIssues` — `id`, `tenantId`, `issueNumber` (`unique`), `storeId` FK, `issueToRole` enum (`student/staff/guest`), `studentId` nullable FK, `issueToName`, `issueDate`, `dueDate`, `returnDate` (nullable), `status` enum (`issued/returned/overdue/lost/damaged`) — `overdue` is derived (`dueDate < today && returnDate IS NULL`) and recomputed on read, not stored as an authoritative write. `recordedById`, timestamps.
- `inventoryIssueLines` — `id`, `tenantId`, `issueId` FK, `productId` FK, `qty` numeric(14,3).

**Stock adjustments & transfers**
- `inventoryAdjustments` — `id`, `tenantId`, `adjustmentNumber` (`unique`), `storeId` FK, `type` enum (`count_correction/damage/loss/donation/write_off`), `reason`, `note`, `createdById`, timestamps. Applied on create (idempotent).
- `inventoryAdjustmentLines` — `id`, `tenantId`, `adjustmentId` FK, `productId` FK, `direction` enum (`in/out`), `qty` numeric(14,3).
- `inventoryTransfers` — `id`, `tenantId`, `transferNumber` (`unique`), `fromStoreId` FK, `toStoreId` FK, `reason`, `status` enum (`pending/completed/reversed`), `createdById`, `completedAt`, timestamps. `check: fromStoreId != toStoreId`.
- `inventoryTransferLines` — `id`, `tenantId`, `transferId` FK, `productId` FK, `qty` numeric(14,3).

**Movement ledger (source of truth) & balance projection**
- `inventoryStockMovements` — `id`, `tenantId`, `storeId` FK, `productId` FK, `movementType` enum (`receipt/sale/sale_reversal/issue/issue_return/adjustment_in/adjustment_out/transfer_out/transfer_in`), `qty` numeric(14,3) **signed** (`+` in, `-` out), `refType` (`purchase/sale/issue/adjustment/transfer`), `refId`, `idempotencyKey` varchar(160), `actorId`, `reason`, `recordedAt`, `createdAt`. `unique(tenant_id, idempotency_key)`. **Append-only — no UPDATE/DELETE; never altered by a reversal.**
- `inventoryStockBalances` — `id`, `tenantId`, `storeId` FK, `productId` FK, `quantity` numeric(14,3), `updatedAt`. `unique(tenant_id, store_id, product_id)`. **Maintained projection, must equal `SUM(movements.qty)` per (store, product) at all times (reconciliation, §4).**

**Relationships (owned, tenant-scoped):** `products.categoryId→categories`, `purchase→supplier+store`, `purchaseLines→purchase+product`, `sale→store(+student/invoice)`, `saleLines→sale+product(+invoiceItem)`, `issue→store(+student)`, `movement→store+product(+ref)`, `balance→store+product`, `adjustment→store`, `transfer→store×2`. Every FK column referenced from a request body is re-verified `WHERE id=? AND tenantId=?` at the service layer.

---

## 3. Immutable stock-movement ledger design

- **Source of truth = `inventoryStockMovements`.** Every stock-affecting event — receipt, sale, sale_reversal, issue, issue_return, adjustment_in/out, transfer_out/in — appends exactly one immutable row per (line, store). No UPDATE/DELETE on this table, ever. Reversals append **compensating** rows (opposite sign) and flip the parent document's status; the original rows stay.
- `qty` is signed by convention (`receipt/sale_reversal/issue_return/adjustment_in/transfer_in` positive; `sale/issue/adjustment_out/transfer_out` negative), stored in **sale/base units**.
- `idempotencyKey` is deterministic per row: `{refType}:{refId}:{storeId}:{productId}:{lineIndex}` (e.g. `sale:550e8400…:store-uuid:prod-uuid:2`). Unique `(tenant_id, idempotency_key)` makes double-post physically impossible — a concurrent retry's duplicate insert hits `23505`, rolls back, and the service re-reads the doc as already-posted (§6).
- `refType`+`refId` let any document's effect be traced; the ledger is the single queryable history for movement reporting and reconciliation.
- `recordedAt` snapshots the business event time (may differ from `createdAt` for backdated docs).

---

## 4. Stock-balance projection and reconciliation design

- `inventoryStockBalances` is a **maintained read projection**, updated in the **same transaction** as the movements it summarizes (§5). It exists purely for fast reads and negative-stock checks; it is never written by routes/UI directly.
- **Reproducibility invariant:** for every `(tenant, store, product)`, `balance.quantity = SUM(movements.qty)`. Enforced two ways:
  1. **Per-write** — every movement batch updates the balance by the same delta in the same txn (upsert `inventoryStockBalances`).
  2. **On-demand reconciliation** — `POST /api/addons/inventory/stock/reconcile` (capability `inventory.export`, tenant-scoped) runs `SELECT store_id, product_id, SUM(qty) FROM inventory_stock_movements GROUP BY 1,2` and `SELECT … FROM inventory_stock_balances`, upserts the projected balance from the movement aggregate, and returns a `discrepancies` array (any row whose pre-reconcile quantity differed). Every discrepancy is also `recordAudit`ed. This is the concrete proof that balances are reproducible.
- A `scripts/verify-inventory-reconcile.sql`-style acceptance check asserts the invariant for both tenants after every phase's live tests.

---

## 5. Exact transaction boundaries and locking strategy

**Single choke point:** every stock-affecting mutation goes through `inventory-transactions.ts` `postStockMovements(tx, …)`. Routes never touch movements/balances directly.

**Within `db.transaction(async (tx) => { … }):`**
1. **Sequence lock** (when generating a reference number): `SELECT pg_advisory_xact_lock(hashtextextended('{tenantId}:{prefix}', 0))` then bump `namingSeries` (exact `reserveVerificationCode` shape, must run inside the open `tx`).
2. **Row locks on balances in deterministic order:** gather all touched `(product, store)` pairs (a transfer touches both stores); sort by `(productId, storeId)`; for each: `INSERT … ON CONFLICT DO NOTHING` the balance row, then `SELECT … FOR UPDATE`. Sorting kills deadlocks between concurrent multi-line documents (e.g. two transfers crossing stores).
3. **Availability check** for out-movements (`sale/issue/adjustment_out/transfer_out`): `newQty = current - outgoing`; if `newQty < 0` → throw `409 INSUFFICIENT_STOCK` with the product code + store in the message. In-movements (`receipt/return/adjustment_in/transfer_in`) never check.
4. **Insert movements** (each with deterministic `idempotencyKey`) and **upsert balances** in the same txn.
5. **Update parent document status** (`received`/`completed`/`returned`/`applied`/…).
6. **Student sale**: create `invoices` + `invoiceItems` + (if paid) `payments` + `paymentAllocations` + invoice `paidAmount`/`status`, mirroring the finance payment route's cents math and advisory lock, **inside the same txn** so stock and invoice are atomic (§8).
7. **Commit.** Only after commit: `recordAudit` (fire-and-forget) and fail-open GL auto-post (`tryPostPaymentGLEntry`/`tryPostExpenseGLEntry`).

**Deadlock/lock scope rules:** locks are always `xact`-scoped and ordered; never lock more than one doc's product set at once; transfers lock both stores' rows (sorted) before inserting either movement, so `transfer_out`+`transfer_in` are atomic (no half-moved stock observable).
**On txn throw** (any step): full rollback — no partial stock/invoice state. `23505` on `idempotency_key` is caught and downgraded to idempotent success after re-reading the doc state (§6).

---

## 6. Idempotency design

Target operations: **receive, sale, issue-return, adjustment-apply, transfer-complete** (the "post" transitions).

- **Document-state guard:** each transition is a status change (`ordered→received`, `completed`, `issued→returned`, `pending→completed`). On entry, re-read the doc tenant-scoped; if it is **already in the target state**, return the existing doc as `200` (idempotent success) without touching stock.
- **Movement-level guard:** even under a concurrent race (both requests pass the state guard before either commits), the unique `(tenant_id, idempotency_key)` on `inventoryStockMovements` makes the second insert fail `23505`, which rolls back the second txn; the handler catches it, re-reads the doc, and returns success. The stock effect is applied exactly once, guaranteed by the constraint, not by timing.
- **Client retries:** optional `Idempotency-Key` request header / `idempotencyKey` body field accepted and stored on the doc; a retry with the same key short-circuits to the existing result. Not required for correctness (the deterministic per-line key is the real guard) — treated as a convenience and validated as a UUID-ish string ≤ 80 chars.
- **No DELETE anywhere for posted documents.** Reversal = compensating movement + status flip (§10–§11).

---

## 7. Purchasing and receiving lifecycle

- **Create purchase (status `ordered`):** supplier + store + lines (product, qty in purchase unit, unit cost). `netAmount = Σ lineTotal` computed server-side in cents (`lineTotal = qty × unitCost` via scaled-int math, §money). No stock change. Reference `PUR-{year}-######`.
- **Receive (`POST …/purchases/[id]/receive`, idempotent):** only when `status=ordered`; flips to `received`, sets `receivedAt`, and posts one **receipt** movement per line into the purchase's store with `qty_base = qtyInPurchaseUnit × product.unitRatio` (decimal-safe), positive.
- **Expense link:** on receive, create one `expenses` row (category `supplies` — an existing enum value, **no enum migration needed**; `amount = netAmount`, `expenseDate = receivedAt`, `description = "Achat N° {purchaseNumber} — {supplier}"`, `recordedById`) and store `expenseId` on the purchase; fire `tryPostExpenseGLEntry` fail-open after commit. If the expense insert fails, the txn fails — stock and expense stay atomic.
- **Payment status** (`unpaid/partial/paid`) derived from `paidAmount` vs `netAmount` in cents on read; `paidAmount` is updated when a payment is recorded (inventory purchase payment record is a minimal paid/payment-method snapshot on the purchase — **not** a second general ledger; supplier payable/AP ledgers are out of scope).
- **Reverse a received purchase** (deferred, §16): v1 supports `ordered→reversed` (no stock effect) only. Reversing a *received* purchase posts compensating `receipt`-negative movements and marks `reversed`; **Finance expense reversal is deferred** (documented).

---

## 8. Student, staff and guest sales behavior

**Sale-to-role is the fork in the road.** `inventorySales.saleToRole ∈ {student, staff, guest}`.

- **Student sale** (role `student`, `studentId` required, re-verified against tenant):
  - Creates a **real `invoices`** row: `studentId`, `invoiceNumber = INV-{year}-{4 digits}` (matches finance format), `amount = Σ lineTotal`, `discountAmount = 0`, `netAmount = amount`, `paidAmount = recorded payment`, `status` per payment, `dueDate = saleDate`, `issueDate = saleDate`, `note = "Vente N° {saleNumber}"`.
  - Creates **`invoiceItems`** — one per sale line: `description = "{productName} × {qty}"`, `amount = lineTotal`. (First writer of this table — matches the read shape of invoice detail.)
  - Records **`payments`** + **`paymentAllocations`** for the paid portion and updates `invoices.paidAmount`/`status` — mirroring the finance payment route (advisory lock + cents + `paid`/`partial`). **All inside the same txn as the stock movements** (§5 step 6), so stock can never decrement without its invoice.
  - `inventorySales.invoiceId` links back for traceability; the money truth lives in Finance. The family's normal billing history (statements, invoices-by-student) picks it up with **zero inventory-side read code**.
- **Staff/guest counter sale** (`staff`/`guest`, `customerName` recorded): **no `invoices`/`payments` rows** (no student, no family ledger to join — `invoices.studentId` is NOT NULL so it is structurally impossible anyway). `netAmount`/`paidAmount`/`paymentMethod`/`paymentReference` live on the sale record. This is an inventory counter-sale snapshot, not a parallel family payment ledger.
- **Reversal** (`POST …/sales/[id]/reverse`): posts `sale_reversal` movements (restores stock), sets `status=reversed` + reason. **Finance-side reversal of a student invoice (credit note / refund) is deferred** (§16) — v1 restores stock and flags the invoice for later reconciliation; the paid invoice remains in Finance untouched.
- **Cashier session:** finance enforces `cashierSessions` only for `accountant`+cash. Inventory POS will record `paymentMethod` but **not** enforce cashier sessions in v1 (deferred).

---

## 9. Invoice / payment / expense integration strategy

- **Reuse, don't duplicate:** `@/libs/finance/money` for all cents math; `@/libs/finance/gl-auto-post` for fail-open GL. The student-sale invoice/payment block reproduces the finance payment route's *logic* (advisory lock, balance check, allocation, status recompute) but inside the inventory txn — it is a shared-behavior contract, not a fork of the file. **Do not modify `finance/*` routes.**
- **`expenses`:** received purchases create one expense row (§7). No enum change (category `supplies`).
- **No second ledger:** student money goes exclusively through `invoices`/`payments`/`paymentAllocations`. Staff/guest counter sales keep a local paid snapshot only (no student involved, so no family-history drift is possible).
- **GL:** after commit, fire `tryPostPaymentGLEntry` (student sale payment) / `tryPostExpenseGLEntry` (received purchase). Both fail open — never block the sale/receipt on CoA/fiscal-period configuration.
- **Audit:** `recordAudit(create, 'invoice'|'payment'|'expense'|'inventory_*', …)` after commit, in addition to the append-only movement ledger.

---

## 10. Equipment issue, return, lost and damaged workflows

- **Issue (`POST …/issues`):** role (student/staff/guest) + `issueToName`/`studentId` + store + lines (product, qty) + issue/due dates. Posts one **issue** movement per line (negative) after availability check. Reference `ISS-{year}-######`. `status=issued`, `returnDate=NULL`.
- **Return (`POST …/issues/[id]/return`, idempotent):** body `{ disposition: 'returned' | 'damaged' | 'lost' }`:
  - `returned` → one **issue_return** movement per line (positive, restores sellable stock), `returnDate=today`, `status=returned`.
  - `damaged` → posts **adjustment_out** (the units leave sellable stock) with `reason`, `status=damaged`, `returnDate=today`.
  - `lost` → posts **adjustment_out** (same), `status=lost`.
  - Both non-`returned` dispositions are the "item does not come back to stock" path; the ledger keeps a positive issue and a negative adjustment_out, preserving full history. Idempotency = state guard + per-line keys (§6).
- **Overdue indicator:** `overdue` is derived at read time (`dueDate < today && returnDate IS NULL && status='issued'`) and surfaced as a red badge; no background job in v1.

---

## 11. Stock adjustment and store-transfer workflows

- **Adjustment (`POST …/adjustments`):** header (store, type, reason) + lines (product, direction `in`/`out`, qty). Applying posts `adjustment_in`/`adjustment_out` movements and upserts balances in the same txn; out-lines run the availability check. Idempotent via the doc being `applied` once + per-line keys. Reference `ADJ-{year}-######`.
- **Transfer (`POST …/transfers`):** `fromStoreId`, `toStoreId` (≠), reason, lines. Status `pending` (no stock effect yet). **`POST …/transfers/[id]/complete` (idempotent):** in one txn, lock both store balance rows (sorted), post **transfer_out** (−) at `fromStore` and **transfer_in** (+) at `toStore` for the same qty, `status=completed`. Availability checked against `fromStore` only. `cancel` allowed only while `pending` (no stock effect to undo).

---

## 12. Permissions and add-on gating

**New keys in `PERMISSIONS` (`permissions.ts`)** — dot-separated, French labels:
```
'inventory.read': 'Consulter l\'inventaire et les stocks'
'inventory.catalog.manage': 'Gérer les produits, catégories, unités, magasins et fournisseurs'
'inventory.purchase.manage': 'Gérer les achats et les réceptions'
'inventory.sell': 'Enregistrer les ventes (caisse/boutique)'
'inventory.issue.manage': 'Gérer les prêts, retours et sorties'
'inventory.adjust.manage': 'Gérer les ajustements et transferts de stock'
'inventory.export': 'Exporter les données inventaire et réconcilier'
```
**Role defaults** (`DEFAULT_ROLE_PERMISSIONS`): `super_admin`/`school_admin` get all automatically (via `ALL_PERMISSIONS`). Propose: `receptionist` += `inventory.read` + `inventory.sell` (front-desk shop); `accountant` += `inventory.read` + `inventory.purchase.manage` (procurement is finance-adjacent). `teacher`/`student`/`parent`/`guard`/`alumni` get none. (Decision point §17.4.)

**Add-on gating** — every `/api/addons/inventory/*` route:
```
requireRequestContext(request, [roles]?) → requireTenant(ctx) → requireAddon(tenantId, 'inventory') → requireCapability(ctx, 'inventory.…')
```
**Dev activation (Phase 0):** insert `addonEntitlements` rows (`isEnabled=true`) for Atlas + SchoolOS for `addonId='inventory'` (events precedent). `registry.ts` already lists the addon; leave its `enabled:false` candidate flag as-is unless activation requires otherwise (verify, don't assume). **Addon-disabled regression:** with entitlement off, every inventory route → `403 ADDON_NOT_ACTIVATED`; `finance/*`, `users`, student billing → unchanged 200. Re-enable → data visible again.

---

## 13. API inventory (all `/api/addons/inventory/…`)

| Route | Methods | Capability | Notes |
|---|---|---|---|
| `/categories` | GET/POST | `inventory.read` / `inventory.catalog.manage` | list (status filter/search) / create; `unique(tenant,name)` 409. Archive-only delete; 409 `IN_USE` if referenced by a product. |
| `/categories/[id]` | PATCH/DELETE | `inventory.catalog.manage` | archive-only delete + `IN_USE` guard. |
| `/units` `/units/[id]` | GET/POST/PATCH/DELETE | `inventory.read` / `inventory.catalog.manage` | `IN_USE` guard when referenced by a product. |
| `/stores` `/stores/[id]` | GET/POST/PATCH/DELETE | `inventory.read` / `inventory.catalog.manage` | `unique(tenant,code)` 409; archive-only delete + `IN_USE`. |
| `/suppliers` `/suppliers/[id]` | GET/POST/PATCH/DELETE | `inventory.read` / `inventory.catalog.manage` | supplier product list derived from purchase lines. |
| `/products` `/products/[id]` | GET/POST/PATCH/DELETE | `inventory.read` / `inventory.catalog.manage` | GET returns computed `stockByStore` + price margin warning; archive-only delete + `IN_USE` (purchase/sale/issue/movement refs). |
| `/purchases` | GET/POST | `inventory.read` / `inventory.purchase.manage` | list w/ filters (supplier/store/status/date); create = `ordered`. |
| `/purchases/[id]` | GET | `inventory.read` | detail + lines. |
| `/purchases/[id]/receive` | POST | `inventory.purchase.manage` | idempotent receive (§7). |
| `/purchases/[id]/reverse` | POST | `inventory.purchase.manage` | v1: `ordered→reversed` only; received-purchase reverse deferred (§16). |
| `/sales` | GET/POST | `inventory.read` / `inventory.sell` | create with role fork (§8); student → invoice/payment integration. |
| `/sales/[id]` | GET | `inventory.read` | detail + lines + finance link. |
| `/sales/[id]/reverse` | POST | `inventory.sell` | compensating `sale_reversal`; invoice/credit-note deferral documented. |
| `/issues` | GET/POST | `inventory.read` / `inventory.issue.manage` | list incl. overdue derivation. |
| `/issues/[id]` | GET | `inventory.read` | detail + lines. |
| `/issues/[id]/return` | POST | `inventory.issue.manage` | `{ disposition }` returned/damaged/lost (§10), idempotent. |
| `/adjustments` | GET/POST | `inventory.read` / `inventory.adjust.manage` | applied on create (idempotent). |
| `/transfers` | GET/POST | `inventory.read` / `inventory.adjust.manage` | pending create. |
| `/transfers/[id]/complete` | POST | `inventory.adjust.manage` | paired movements, idempotent. |
| `/transfers/[id]/cancel` | POST | `inventory.adjust.manage` | pending-only. |
| `/stock` | GET | `inventory.read` | balances by store/product + filters + `lowStock` threshold param. |
| `/stock/reconcile` | POST | `inventory.export` | recompute balances from movements; return discrepancies; audit. |
| `/movements` | GET | `inventory.read` | ledger with filters (product/store/type/date/doc). |
| `/overview` | GET | `inventory.read` | KPIs: products, total stock value, low-stock count, open issues, overdue, recent movements. |
| `/export` | GET | `inventory.export` | CSV of balances/movements honoring filters + tenant boundary. |

All bodies Zod `.strict()`; every foreign id re-verified tenant-scoped; `recordAudit` after commit; errors via `ApiError`/`apiErrorResponse`.

---

## 14. Page and component inventory (`/dashboard/inventory/…`)

Single-file `'use client'` pages (shared-context §9 pattern — fetch-driven, French copy, no mock arrays). Header icon gradient `#2487B8→#1B6C93`; KPI stat cards; data-dense tables; `Badge` variants `success/info/warning/danger/neutral/signal` only.

| Page | Route | Contents |
|---|---|---|
| Aperçu | `/dashboard/inventory/overview` | KPI banner (products, stock value, low stock, open/overdue issues) + recent movements + low-stock table. |
| Produits | `/dashboard/inventory/products` | catalog table incl. computed `stockByStore` column + create/edit dialog + margin soft-warning + search/category filter. |
| Catégories | `/dashboard/inventory/categories` | flat CRUD + `IN_USE` delete guard. |
| Unités | `/dashboard/inventory/units` | flat CRUD. |
| Magasins | `/dashboard/inventory/stores` | CRUD (name/code/contact/address) + per-store stock summary. |
| Fournisseurs | `/dashboard/inventory/suppliers` | CRUD + derived product list. |
| Achats | `/dashboard/inventory/purchases` | list (status/payment badges) + create dialog (supplier/store/lines) + **Receive** action + payment entry. |
| Ventes | `/dashboard/inventory/sales` | list + POS create dialog (role/student-picker/store/lines/payment) + reverse action. |
| Prêts & Sorties | `/dashboard/inventory/issues` | list with overdue red badge + create + return/damaged/lost actions. |
| Stock | `/dashboard/inventory/stock` | balances by store/product (filterable), adjustments create, transfers create/complete, movement history, reconcile button. |

**Sidebar** (`src/components/shared/sidebar.tsx`): add an Inventory section after the Finance section — `{ label: 'Inventaire', href: \`/${locale}/dashboard/inventory\`, icon: Package /* already imported */, permission: 'inventory.read', subItems: [Aperçu, Produits, Achats, Ventes, Prêts & Sorties, Stock] }`, sub-item permissions per capability. Pages with no sidebar entry are unreachable — don't skip this.

---

## 15. Migration and rollback strategy

**Migration `migrations/0076_inventory_management.sql`** — hand-written, idempotent, single transaction-style (`BEGIN`/`COMMIT` at file level is **not** used by sibling migrations; they use `--> statement-breakpoint` blocks with `CREATE TABLE IF NOT EXISTS` + `DO $$ … EXCEPTION WHEN duplicate_object`). Create, in order:
1. Enums (`CREATE TYPE …` via `DO $$` idempotent blocks): `inventory_movement_type`, `inventory_purchase_status`, `inventory_sale_status`, `inventory_sale_to_role`, `inventory_issue_status`, `inventory_adjustment_type`, `inventory_transfer_status`.
2. Master-data tables: `inventory_categories`, `inventory_units`, `inventory_stores`, `inventory_suppliers`, `inventory_products` (+ FKs + tenant-scoped uniques).
3. Documents: `inventory_purchases`+`inventory_purchase_lines`, `inventory_sales`+`inventory_sale_lines`, `inventory_issues`+`inventory_issue_lines`, `inventory_adjustments`+`inventory_adjustment_lines`, `inventory_transfers`+`inventory_transfer_lines`.
4. Ledger + projection: `inventory_stock_movements` (`unique(tenant_id, idempotency_key)`), `inventory_stock_balances` (`unique(tenant_id, store_id, product_id)`), + supporting indexes (`(tenant_id, store_id, product_id)`, `(tenant_id, ref_type, ref_id)`, `(tenant_id, recorded_at)`).
5. No ALTERs to existing tables; **no backfill** (ledger starts empty; balances empty until first movement).

Then append exactly one journal entry: `{ "version":"7", "when":<ts > 1786500000000>, "tag":"0076_inventory_management", "breakpoints":true, "idx":77 }`.

**Verify:** `docker compose build migrate` (sequential, not parallel) then `docker compose up migrate` → exit 0; rerun → no change. `npx tsc --noEmit`, `npx next build`, `npx tsx scripts/check-tenant-isolation.ts`.

**Rollback:** no feature data exists pre-phase-1 (empty ledger), so rollback = drop the new tables in reverse dependency order (movements→balances→documents→master) and remove the journal entry; no data migration required. Documented here; in practice an applied migration is never dropped after other work lands.

---

## 16. Atomic build phases (each ends in a green gate)

Shared gate after **every** phase: `npx tsc --noEmit` (0), `npx next build` (exit 0), `docker compose build migrate && docker compose up migrate` (captured exit codes), `npx tsx scripts/check-tenant-isolation.ts` (no new flags), plus the live checks for that phase.

- **Phase 0 — Preflight (no code):** `git status --short` snapshot of the 7 shared files; confirm highest migration = `0075`, journal idx 76; insert `inventory` entitlement rows for Atlas + SchoolOS; confirm dev server + DB up.
- **Phase 1 — Schema + migration + math/sequence + permissions:** `inventory-schema.ts`, `0076` migration + journal entry, `permissions.ts` `inventory.*` keys + role defaults, Schema.ts barrel line, `inventory-math.ts` pure helpers + vitest (deliberately-break-to-prove), `inventory-sequence.ts`. Verify: migrate applies idempotently, tsc.
- **Phase 2 — Catalog + ledger + balances + reconcile:** catalog service + CRUD routes + products (stockByStore) + `inventory-transactions.ts` + `stock`/`reconcile` + master-data pages. Verify: CRUD, tenant isolation on every foreign id, balance==Σmovements reconcile, archive `IN_USE` guards.
- **Phase 3 — Purchasing & receiving:** purchases routes + receive + expense link + GL. Verify: ordered≠stock, receive-once idempotency, expense row created, GL fail-open.
- **Phase 4 — Sales/POS + Finance integration:** sales routes + student invoice/payment integration + staff/guest counter + reversal. Verify: student sale appears in finance history, no double stock, idempotent retry, negative-stock race, reversal restores stock once.
- **Phase 5 — Issues/returns + adjustments + transfers.** Verify: return restores once, damaged/lost dispositions, adjustment in/out, transfer pairs atomic + idempotent complete.
- **Phase 6 — Overview/reports/exports + addon-disable + full acceptance:** overview/export/movements pages, addon-disable regression, complete test matrix (§17) incl. two-tenant sweep + reconciliation SQL + concurrency race scripts.

**Deliberately deferred (written down, not dropped):**
1. **Finance reversal of a student sale** (credit note / refund for a reversed sale) — v1 restores stock + flags the invoice; credit-note/refund integration later.
2. **Expense reversal of a received purchase** — v1 reverses stock only; reversing the linked `expenses` row deferred.
3. **Generic unit↔unit conversion table** — ratio stays per-product (source spec explicitly prefers this).
4. **Cashier-session enforcement for POS cash** — finance's drawer workflow not wired into inventory POS in v1.
5. **Supplier AP/payable ledger, multi-currency, RFQs/reorder suggestions** — out of scope.
6. **PDF exports / barcode-QR scanning** — CSV in v1; PDF/barcode deferred (infra-heavy; match deployment scale).
7. **Negative-stock policy toggle** — v1 hard-blocks negative stock; no per-product override.

---

## 17. Concurrency, reconciliation and cross-tenant test matrix

| # | Test | Acceptance |
|---|---|---|
| C1 | Two concurrent sales, 1 unit left | Exactly one `200`, other `409 INSUFFICIENT_STOCK`; balance never negative; movements = 1× sale only. |
| C2 | Retried receive / sale / return with same doc | Stock effect applied exactly once (state guard + `unique(idempotency_key)`); duplicate returns `200` with existing doc. |
| C3 | Balance reconciliation | For both tenants: `balance.quantity == SUM(movements.qty)` per (store, product) after every phase's live ops; `stock/reconcile` returns zero discrepancies. |
| C4 | Ordered vs received | `ordered` purchase → no movement, balance 0; after receive → receipt movements exactly once. |
| C5 | Student sale in family history | `invoices` row + `payments` row appear for that `studentId` in `/api/finance/statements` and `/api/finance/invoices?studentId=`. |
| C6 | Cross-tenant adversarial | Tenant A cannot GET/PATCH tenant B's product/store/supplier; body with tenant-B `studentId`/`categoryId`/`productId`/`storeId` → 422/404; transfer/issue FKs tenant-checked. |
| C7 | Reversal auditability | Reversed sale/purchase issue: original movements intact + compensating rows present; no DELETEs; timeline shows both. |
| C8 | Addon disabled | Inventory routes → `403 ADDON_NOT_ACTIVATED`; `finance/*`, `/api/users`, student billing → still 200; re-enable → data visible. |
| C9 | Transfer atomicity | Concurrent complete + cancel: no half-posted pair; `transfer_out`+`transfer_in` both present or neither. |
| C10 | Deadlock freedom | Two simultaneous multi-line transfers crossing stores complete without error/timeout (sorted-lock order). |
| C11 | Money/quantity precision | Line totals and `netAmount` computed in cents/scaled-int; no float drift over a 100-line doc; `reconcile` + totals stable. |
| C12 | Finance regression | `/api/finance/invoices`, `/payments`, `/expenses` still pass their existing flows (payment exceeds balance → 409, etc.) after inventory ships. |
| C13 | Isolation static | `scripts/check-tenant-isolation.ts` flags only the known 3-file baseline; no new flags from inventory routes. |
| C14 | Gates | `tsc --noEmit` 0, `next build` exit 0, `docker compose up migrate` exit 0 twice, live HTTP evidence per phase. |

---

## 18. Exact files expected to be created or modified

### Created
- `src/features/inventory/models/inventory-schema.ts`
- `src/features/inventory/services/inventory-math.ts` (pure decimal helpers) + `src/features/inventory/services/inventory-math.test.ts` (vitest)
- `src/features/inventory/services/inventory-sequence.ts`
- `src/features/inventory/services/inventory-transactions.ts`
- `src/features/inventory/services/catalog-service.ts`
- `src/features/inventory/services/purchases-service.ts`
- `src/features/inventory/services/sales-service.ts`
- `src/features/inventory/services/issues-service.ts`
- `src/features/inventory/services/adjustments-service.ts`
- `src/features/inventory/services/transfers-service.ts`
- `src/features/inventory/services/reconcile-service.ts`
- `src/features/inventory/services/overview-service.ts`
- API routes under `src/app/api/addons/inventory/**` (categories, units, stores, suppliers, products, purchases, sales, issues, adjustments, transfers, stock, movements, overview, export — each with `[id]` variants)
- Pages under `src/app/[locale]/(dashboard)/dashboard/inventory/**` (overview, products, categories, units, stores, suppliers, purchases, sales, issues, stock)
- `migrations/0076_inventory_management.sql`
- `scripts/verify-inventory-{catalog,purchases,sales,issues,acceptance}.mjs` (live HTTP + pg evidence)
- `scripts/verify-inventory-reconcile.sql` (reconciliation invariant)

### Modified (shared — collision protocol §17.1 applies)
- `src/models/Schema.ts` — one barrel line `export * from '@/features/inventory/models/inventory-schema';`
- `migrations/meta/_journal.json` — one entry, `idx: 77`
- `src/libs/api/permissions.ts` — `inventory.*` keys + role defaults
- `src/addons/registry.ts` — only if activation requires (verify; likely unchanged)
- `src/components/shared/sidebar.tsx` — Inventory section
- `package.json` / `package-lock.json` — only if a new dependency is justified (none expected; do not add without a written reason)

### Explicitly NOT touched
- `src/models/Schema.ts` invoice/payment/expense **table definitions** (read-only integration surface)
- `src/app/api/finance/**` (all routes)
- `src/libs/finance/*` (money, gl-auto-post, finance-ledger) — **reused, not edited**
- `src/features/hr/**` (owned by HR agent)
- `migrations/meta/_journal.json` entries before idx 77 (do not "fix" sparse history)

---

## 19. Binding decisions (immutable)

1. Product stock is **not** an editable product field. `inventoryProducts` has no quantity column.
2. **Immutable movements are the source of truth.** `inventoryStockMovements` is append-only; reversals add compensating rows, never erase.
3. A maintained balance exists **only** as a reproducible projection equal to `SUM(movements)`; enforced per-write and by `stock/reconcile`.
4. **Student sales integrate with existing invoices/payments** — real `invoices`/`invoiceItems`/`payments`/`paymentAllocations` rows, atomically with stock.
5. **No second student-family payment ledger.** Staff/guest counter sales keep a local paid snapshot only (no student involved).
6. **Purchases affect stock only when received.** `ordered` posts nothing.
7. **Posted transactions are reversed through compensating movements, never erased.**
8. **Sale, receipt, return and transfer operations are idempotent** (state guard + `unique(tenant_id, idempotency_key)`).
9. **Transactions prevent concurrent negative stock** (row locks in deterministic order + availability check inside the txn).
10. **Monetary calculations happen server-side using decimal-safe values** (`@/libs/finance/money` cents; quantities via scaled-int math).
11. **Every foreign ID is revalidated against tenantId** (`WHERE id=? AND tenantId=?`).
12. **Never run drizzle-kit generate.** Hand-write `0076` + journal entry.
13. Migration numbering assigned after checking the current repo — verified **0076 / idx 77** (highest now `0075`, idx 76).

## 20. Shared-file collision protocol (with HR)

Inventory runs in parallel with HR. Before touching any of the 7 shared files, run `git status --short` and confirm no other agent has uncommitted edits to the specific region being changed (Schema.ts barrel tail ~3970, permissions map + role arrays, journal tail). Send HR the exact delta (barrel line, permission keys, journal entry, sidebar block) rather than hand-merging blindly. HR owns `src/features/hr/**`; Inventory owns `src/features/inventory/**`; Finance routes/libs are shared read-only surfaces.

*End of plan. Implementation starts only after this plan is reviewed and per-phase green gates are met.*
