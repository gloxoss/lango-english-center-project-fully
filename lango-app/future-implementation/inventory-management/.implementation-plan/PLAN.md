# Inventory Management — Implementation Plan

Read the shared context and source specification first. Inventory is a tenant add-on and a new domain, but it must integrate with existing Finance rather than create a competing ledger.

## 1. Decisions

- Use an immutable stock-movement ledger as source of truth. Do not store editable stock quantity on products.
- Maintain an optional transactionally updated `inventoryStockBalances` projection per product/store for fast reads; every balance must be reproducible from movements.
- Student sales create/link real Finance invoices and payments. Staff/guest counter sales use inventory sale/payment records and must not impersonate family billing.
- Received purchases may link to a real Finance expense; ordered purchases do not change stock.
- Product unit ratio is per product. Quantities are stored in the product sale/base unit.
- Use decimal numeric quantities, prices and totals; never JavaScript floating-point for persisted money.

## 2. Model

Create `src/features/inventory/models/inventory-schema.ts`:

- categories, units, stores, suppliers, products
- supplier-product history derived from purchase lines, not a mutable list
- purchases and purchase lines
- sales and sale lines with optional invoice/payment links
- issues/loans and issue lines
- immutable stock movements (`receipt`, `sale`, `issue`, `return`, `adjustment_in`, `adjustment_out`, `transfer_out`, `transfer_in`)
- stock-balance projection and stock adjustments

All transactional documents have tenant-scoped references, status/version, actor, timestamps and audit metadata. Enforce tenant-unique product/store/reference codes. Prevent negative stock unless a future explicit policy enables it.

## 3. Services and invariants

Centralize all movement creation in one inventory transaction service. UI/routes never update balances directly.

- Receiving is idempotent and posts movements once.
- Cancelling/reversing uses compensating movements; never deletes posted history.
- Sale posting locks affected product/store balance rows, validates availability, posts invoice/payment links atomically where possible, and records recoverable integration state where Finance fails.
- Issue posting reduces availability; return posts the inverse once and supports damaged/lost disposition.
- Store transfers post paired movements inside one transaction.
- Purchase and sale totals are recalculated server-side from lines.
- Reference numbers use a concurrency-safe tenant sequence.

## 4. API and UI

APIs under `/api/addons/inventory/` for categories, units, stores, suppliers, products, stock, purchases, sales, issues, adjustments and transfers. Add capabilities for read, catalog, purchasing, selling, issuing, adjusting and reporting.

Pages under `/dashboard/inventory/`:

- Overview/low stock and recent activity
- Products, categories, units, stores, suppliers
- Purchases and receipt workflow
- Sales/POS and Finance status
- Issues/returns/overdue
- Stock by store, adjustments, movement history and transfers

Use real fetches and French copy; no mock inventory arrays.

## 5. Delivery

1. Catalog, stores, suppliers, movement ledger and stock projection.
2. Purchase ordering/receiving and optional expense link.
3. Sales with student invoice/payment integration.
4. Issue/return, adjustments and store transfers.
5. Reporting, exports, reconciliation and addon-disable verification.

## 6. Acceptance

- Two concurrent sales for the last unit cannot both succeed.
- Retried receipt/sale/return requests do not double-post stock.
- Every displayed balance reconciles exactly to movement sums.
- Ordered purchases do not affect stock; received purchases do exactly once.
- Student sale appears in the existing family Finance history.
- Cross-tenant products, stores, suppliers, students, invoices and payments are rejected.
- Reversals preserve an auditable history.
- Disabling Inventory does not break Finance or student billing.
- Live race tests, movement reconciliation SQL, two-tenant sweep, Docker migration/build, TypeScript and isolation checks pass.

