// Inventory Management add-on schema.
//
// Feature-schema pattern (mirrors hr-schema.ts): shared types (tenants, user,
// branches, invoices, invoiceItems, expenses) are imported from '@/models/Schema'
// and this file is re-exported by the Schema.ts barrel at the bottom. Drizzle FK
// callbacks are lazy, so the circular import resolves. payment_method is declared
// as a local pgEnum (same DB type as the finance enum) rather than imported: the
// barrel loads feature schemas before Schema.ts's own body finishes evaluating, so
// referencing a barrel-imported enum at table-definition time throws a TDZ error.
//
// Stock invariants (see future-implementation/inventory-management/.implementation
// -plan/EXECUTION-PLAN.md §19):
//  - products have NO stock column — stock lives only in the append-only
//    inventoryStockMovements ledger + the reproducible inventoryStockBalances
//    projection.
//  - monetary columns follow the finance convention (numeric(14,2), mode
//    'number'); quantities are numeric(14,3) string-mode, arithmetic done via
//    scaled-int helpers in services/inventory-math.ts.
//  - posted documents are never erased — reversal = compensating movements.
import { sql } from 'drizzle-orm';
import { boolean, check, date, foreignKey, index, numeric, pgEnum, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { branches, expenses, invoiceItems, invoices, tenants, user } from '@/models/Schema';

// ---------------------------------------------------------------------------
// Enums (created idempotently in migration 0076)
// ---------------------------------------------------------------------------

export const inventoryMovementType = pgEnum('inventory_movement_type', [
  'receipt', 'sale', 'sale_reversal', 'issue', 'issue_return',
  'adjustment_in', 'adjustment_out', 'transfer_out', 'transfer_in',
]);
export const inventoryPurchaseStatus = pgEnum('inventory_purchase_status', ['ordered', 'received', 'reversed']);
export const inventorySaleStatus = pgEnum('inventory_sale_status', ['completed', 'reversed']);
export const inventorySaleToRole = pgEnum('inventory_sale_to_role', ['student', 'staff', 'guest']);
export const inventoryIssueStatus = pgEnum('inventory_issue_status', ['issued', 'returned', 'overdue', 'lost', 'damaged']);
export const inventoryAdjustmentType = pgEnum('inventory_adjustment_type', ['count_correction', 'damage', 'loss', 'donation', 'write_off']);
export const inventoryTransferStatus = pgEnum('inventory_transfer_status', ['pending', 'completed', 'reversed']);
export const inventoryPaymentMethod = pgEnum('payment_method', ['cash', 'card', 'transfer', 'check']);

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------

export const inventoryCategories = pgTable('inventory_categories', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_categories_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('inventory_categories_tenant_name_unique').on(table.tenantId, table.name),
]);

export const inventoryUnits = pgTable('inventory_units', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  abbreviation: varchar('abbreviation', { length: 20 }),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_units_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('inventory_units_tenant_name_unique').on(table.tenantId, table.name),
]);

export const inventoryStores = pgTable('inventory_stores', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  branchId: uuid('branch_id'),
  mobile: varchar('mobile', { length: 50 }),
  address: text('address'),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_stores_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.branchId],
    foreignColumns: [branches.id],
    name: 'inventory_stores_branch_id_branches_id_fk',
  }).onDelete('set null'),
  unique('inventory_stores_tenant_code_unique').on(table.tenantId, table.code),
]);

export const inventorySuppliers = pgTable('inventory_suppliers', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  companyName: varchar('company_name', { length: 255 }),
  address: text('address'),
  contactName: varchar('contact_name', { length: 120 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_suppliers_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('inventory_suppliers_tenant_name_unique').on(table.tenantId, table.name),
]);

export const inventoryProducts = pgTable('inventory_products', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  code: varchar('code', { length: 40 }).notNull(),
  categoryId: uuid('category_id'),
  purchaseUnitId: uuid('purchase_unit_id'),
  saleUnitId: uuid('sale_unit_id'),
  unitRatio: numeric('unit_ratio', { precision: 14, scale: 3 }).default('1').notNull(), // sale-units per purchase-unit
  purchasePrice: numeric('purchase_price', { precision: 14, scale: 2, mode: 'number' }),
  salePrice: numeric('sale_price', { precision: 14, scale: 2, mode: 'number' }),
  remarks: text('remarks'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_products_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.categoryId],
    foreignColumns: [inventoryCategories.id],
    name: 'inventory_products_category_id_inventory_categories_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.purchaseUnitId],
    foreignColumns: [inventoryUnits.id],
    name: 'inventory_products_purchase_unit_id_inventory_units_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.saleUnitId],
    foreignColumns: [inventoryUnits.id],
    name: 'inventory_products_sale_unit_id_inventory_units_id_fk',
  }).onDelete('restrict'),
  unique('inventory_products_tenant_code_unique').on(table.tenantId, table.code),
]);

// ---------------------------------------------------------------------------
// Purchasing
// ---------------------------------------------------------------------------

export const inventoryPurchases = pgTable('inventory_purchases', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  purchaseNumber: varchar('purchase_number', { length: 50 }).notNull(),
  supplierId: uuid('supplier_id').notNull(),
  storeId: uuid('store_id').notNull(),
  status: inventoryPurchaseStatus('status').default('ordered').notNull(),
  orderDate: date('order_date').notNull(),
  receivedAt: timestamp('received_at', { mode: 'string' }),
  netAmount: numeric('net_amount', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  paidAmount: numeric('paid_amount', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  paymentMethod: inventoryPaymentMethod('payment_method'),
  paymentReference: varchar('payment_reference', { length: 100 }),
  expenseId: uuid('expense_id'),
  recordedById: text('recorded_by_id'),
  idempotencyKey: varchar('idempotency_key', { length: 160 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_purchases_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.supplierId],
    foreignColumns: [inventorySuppliers.id],
    name: 'inventory_purchases_supplier_id_inventory_suppliers_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.storeId],
    foreignColumns: [inventoryStores.id],
    name: 'inventory_purchases_store_id_inventory_stores_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.expenseId],
    foreignColumns: [expenses.id],
    name: 'inventory_purchases_expense_id_expenses_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.recordedById],
    foreignColumns: [user.id],
    name: 'inventory_purchases_recorded_by_id_user_id_fk',
  }).onDelete('set null'),
  unique('inventory_purchases_tenant_number_unique').on(table.tenantId, table.purchaseNumber),
  unique('inventory_purchases_tenant_idempotency_key_unique').on(table.tenantId, table.idempotencyKey),
]);

export const inventoryPurchaseLines = pgTable('inventory_purchase_lines', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  purchaseId: uuid('purchase_id').notNull(),
  productId: uuid('product_id').notNull(),
  qtyInPurchaseUnit: numeric('qty_in_purchase_unit', { precision: 14, scale: 3 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 14, scale: 2, mode: 'number' }).notNull(),
  lineTotal: numeric('line_total', { precision: 14, scale: 2, mode: 'number' }).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_purchase_lines_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.purchaseId],
    foreignColumns: [inventoryPurchases.id],
    name: 'inventory_purchase_lines_purchase_id_inventory_purchases_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [inventoryProducts.id],
    name: 'inventory_purchase_lines_product_id_inventory_products_id_fk',
  }).onDelete('restrict'),
  index('inventory_purchase_lines_purchase_idx').on(table.tenantId, table.purchaseId),
]);

// ---------------------------------------------------------------------------
// Sales (POS)
// ---------------------------------------------------------------------------

export const inventorySales = pgTable('inventory_sales', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  saleNumber: varchar('sale_number', { length: 50 }).notNull(),
  storeId: uuid('store_id').notNull(),
  saleToRole: inventorySaleToRole('sale_to_role').notNull(),
  studentId: text('student_id'),
  customerName: varchar('customer_name', { length: 255 }),
  saleDate: date('sale_date').notNull(),
  netAmount: numeric('net_amount', { precision: 14, scale: 2, mode: 'number' }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  paymentMethod: inventoryPaymentMethod('payment_method'),
  paymentReference: varchar('payment_reference', { length: 100 }),
  status: inventorySaleStatus('status').default('completed').notNull(),
  invoiceId: uuid('invoice_id'),
  recordedById: text('recorded_by_id').notNull(),
  reversedById: text('reversed_by_id'),
  reversedAt: timestamp('reversed_at', { mode: 'string' }),
  reversalReason: text('reversal_reason'),
  idempotencyKey: varchar('idempotency_key', { length: 160 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_sales_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.storeId],
    foreignColumns: [inventoryStores.id],
    name: 'inventory_sales_store_id_inventory_stores_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'inventory_sales_student_id_user_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [invoices.id],
    name: 'inventory_sales_invoice_id_invoices_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.recordedById],
    foreignColumns: [user.id],
    name: 'inventory_sales_recorded_by_id_user_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.reversedById],
    foreignColumns: [user.id],
    name: 'inventory_sales_reversed_by_id_user_id_fk',
  }).onDelete('set null'),
  unique('inventory_sales_tenant_number_unique').on(table.tenantId, table.saleNumber),
  unique('inventory_sales_tenant_idempotency_key_unique').on(table.tenantId, table.idempotencyKey),
]);

export const inventorySaleLines = pgTable('inventory_sale_lines', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  saleId: uuid('sale_id').notNull(),
  productId: uuid('product_id').notNull(),
  qty: numeric('qty', { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2, mode: 'number' }).notNull(),
  lineTotal: numeric('line_total', { precision: 14, scale: 2, mode: 'number' }).notNull(),
  invoiceItemId: uuid('invoice_item_id'),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_sale_lines_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.saleId],
    foreignColumns: [inventorySales.id],
    name: 'inventory_sale_lines_sale_id_inventory_sales_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [inventoryProducts.id],
    name: 'inventory_sale_lines_product_id_inventory_products_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.invoiceItemId],
    foreignColumns: [invoiceItems.id],
    name: 'inventory_sale_lines_invoice_item_id_invoice_items_id_fk',
  }).onDelete('set null'),
  index('inventory_sale_lines_sale_idx').on(table.tenantId, table.saleId),
]);

// ---------------------------------------------------------------------------
// Issues / loans
// ---------------------------------------------------------------------------

export const inventoryIssues = pgTable('inventory_issues', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  issueNumber: varchar('issue_number', { length: 50 }).notNull(),
  storeId: uuid('store_id').notNull(),
  issueToRole: inventorySaleToRole('issue_to_role').notNull(),
  studentId: text('student_id'),
  issueToName: varchar('issue_to_name', { length: 255 }),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  returnDate: date('return_date'),
  status: inventoryIssueStatus('status').default('issued').notNull(),
  recordedById: text('recorded_by_id'),
  idempotencyKey: varchar('idempotency_key', { length: 160 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_issues_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.storeId],
    foreignColumns: [inventoryStores.id],
    name: 'inventory_issues_store_id_inventory_stores_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'inventory_issues_student_id_user_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.recordedById],
    foreignColumns: [user.id],
    name: 'inventory_issues_recorded_by_id_user_id_fk',
  }).onDelete('set null'),
  unique('inventory_issues_tenant_number_unique').on(table.tenantId, table.issueNumber),
  unique('inventory_issues_tenant_idempotency_key_unique').on(table.tenantId, table.idempotencyKey),
]);

export const inventoryIssueLines = pgTable('inventory_issue_lines', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  issueId: uuid('issue_id').notNull(),
  productId: uuid('product_id').notNull(),
  qty: numeric('qty', { precision: 14, scale: 3 }).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_issue_lines_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.issueId],
    foreignColumns: [inventoryIssues.id],
    name: 'inventory_issue_lines_issue_id_inventory_issues_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [inventoryProducts.id],
    name: 'inventory_issue_lines_product_id_inventory_products_id_fk',
  }).onDelete('restrict'),
  index('inventory_issue_lines_issue_idx').on(table.tenantId, table.issueId),
]);

// ---------------------------------------------------------------------------
// Adjustments
// ---------------------------------------------------------------------------

export const inventoryAdjustments = pgTable('inventory_adjustments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  adjustmentNumber: varchar('adjustment_number', { length: 50 }).notNull(),
  storeId: uuid('store_id').notNull(),
  type: inventoryAdjustmentType('type').notNull(),
  reason: text('reason'),
  note: text('note'),
  status: varchar('status', { length: 20 }).default('applied').notNull(), // applied | reversed
  createdById: text('created_by_id'),
  idempotencyKey: varchar('idempotency_key', { length: 160 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_adjustments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.storeId],
    foreignColumns: [inventoryStores.id],
    name: 'inventory_adjustments_store_id_inventory_stores_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'inventory_adjustments_created_by_id_user_id_fk',
  }).onDelete('set null'),
  unique('inventory_adjustments_tenant_number_unique').on(table.tenantId, table.adjustmentNumber),
  unique('inventory_adjustments_tenant_idempotency_key_unique').on(table.tenantId, table.idempotencyKey),
]);

export const inventoryAdjustmentLines = pgTable('inventory_adjustment_lines', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  adjustmentId: uuid('adjustment_id').notNull(),
  productId: uuid('product_id').notNull(),
  direction: varchar('direction', { length: 10 }).default('in').notNull(), // in | out
  qty: numeric('qty', { precision: 14, scale: 3 }).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_adjustment_lines_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.adjustmentId],
    foreignColumns: [inventoryAdjustments.id],
    name: 'inventory_adjustment_lines_adjustment_id_inventory_adjustments_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [inventoryProducts.id],
    name: 'inventory_adjustment_lines_product_id_inventory_products_id_fk',
  }).onDelete('restrict'),
  index('inventory_adjustment_lines_adjustment_idx').on(table.tenantId, table.adjustmentId),
]);

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export const inventoryTransfers = pgTable('inventory_transfers', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  transferNumber: varchar('transfer_number', { length: 50 }).notNull(),
  fromStoreId: uuid('from_store_id').notNull(),
  toStoreId: uuid('to_store_id').notNull(),
  reason: text('reason'),
  status: inventoryTransferStatus('status').default('pending').notNull(),
  createdById: text('created_by_id'),
  completedAt: timestamp('completed_at', { mode: 'string' }),
  completedById: text('completed_by_id'),
  cancelledAt: timestamp('cancelled_at', { mode: 'string' }),
  cancelledById: text('cancelled_by_id'),
  idempotencyKey: varchar('idempotency_key', { length: 160 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_transfers_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.fromStoreId],
    foreignColumns: [inventoryStores.id],
    name: 'inventory_transfers_from_store_id_inventory_stores_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.toStoreId],
    foreignColumns: [inventoryStores.id],
    name: 'inventory_transfers_to_store_id_inventory_stores_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'inventory_transfers_created_by_id_user_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.completedById],
    foreignColumns: [user.id],
    name: 'inventory_transfers_completed_by_id_user_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.cancelledById],
    foreignColumns: [user.id],
    name: 'inventory_transfers_cancelled_by_id_user_id_fk',
  }).onDelete('set null'),
  unique('inventory_transfers_tenant_number_unique').on(table.tenantId, table.transferNumber),
  unique('inventory_transfers_tenant_idempotency_key_unique').on(table.tenantId, table.idempotencyKey),
  check('inventory_transfers_from_neq_to_check', sql`${table.fromStoreId} <> ${table.toStoreId}`),
]);

export const inventoryTransferLines = pgTable('inventory_transfer_lines', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  transferId: uuid('transfer_id').notNull(),
  productId: uuid('product_id').notNull(),
  qty: numeric('qty', { precision: 14, scale: 3 }).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_transfer_lines_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.transferId],
    foreignColumns: [inventoryTransfers.id],
    name: 'inventory_transfer_lines_transfer_id_inventory_transfers_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [inventoryProducts.id],
    name: 'inventory_transfer_lines_product_id_inventory_products_id_fk',
  }).onDelete('restrict'),
  index('inventory_transfer_lines_transfer_idx').on(table.tenantId, table.transferId),
]);

// ---------------------------------------------------------------------------
// Movement ledger (append-only source of truth) & balance projection
// ---------------------------------------------------------------------------

export const inventoryStockMovements = pgTable('inventory_stock_movements', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  storeId: uuid('store_id').notNull(),
  productId: uuid('product_id').notNull(),
  movementType: inventoryMovementType('movement_type').notNull(),
  qty: numeric('qty', { precision: 14, scale: 3 }).notNull(), // signed: + in, - out
  refType: varchar('ref_type', { length: 20 }).notNull(), // purchase | sale | issue | adjustment | transfer
  refId: uuid('ref_id').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
  actorId: text('actor_id'),
  reason: text('reason'),
  recordedAt: timestamp('recorded_at', { mode: 'string' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_stock_movements_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.storeId],
    foreignColumns: [inventoryStores.id],
    name: 'inventory_stock_movements_store_id_inventory_stores_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [inventoryProducts.id],
    name: 'inventory_stock_movements_product_id_inventory_products_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.actorId],
    foreignColumns: [user.id],
    name: 'inventory_stock_movements_actor_id_user_id_fk',
  }).onDelete('set null'),
  unique('inventory_stock_movements_tenant_idempotency_key_unique').on(table.tenantId, table.idempotencyKey),
  index('inventory_stock_movements_tenant_store_product_idx').on(table.tenantId, table.storeId, table.productId),
  index('inventory_stock_movements_tenant_ref_idx').on(table.tenantId, table.refType, table.refId),
  index('inventory_stock_movements_tenant_recorded_at_idx').on(table.tenantId, table.recordedAt),
]);

export const inventoryStockBalances = pgTable('inventory_stock_balances', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  storeId: uuid('store_id').notNull(),
  productId: uuid('product_id').notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).default('0').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'inventory_stock_balances_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.storeId],
    foreignColumns: [inventoryStores.id],
    name: 'inventory_stock_balances_store_id_inventory_stores_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [inventoryProducts.id],
    name: 'inventory_stock_balances_product_id_inventory_products_id_fk',
  }).onDelete('cascade'),
  unique('inventory_stock_balances_tenant_store_product_unique').on(table.tenantId, table.storeId, table.productId),
  index('inventory_stock_balances_tenant_product_idx').on(table.tenantId, table.productId),
]);
