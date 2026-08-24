import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  foreignKey,
} from 'drizzle-orm/pg-core';
import {
  branches,
  cashierSessions,
  classes,
  classSections,
  feeSchedules,
  feeStructures,
  invoices,
  payments,
  tenants,
  user,
} from '@/models/Schema';

// Student Accounting add-on — new tables from future-implementation/
// student-accounting (fee/fine/receivable subledger). All money columns use
// fixed-precision numeric; every table is tenant-scoped with cascade delete.

export const finePolicies = pgTable('fine_policies', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  scopeClassId: uuid('scope_class_id'),
  scopeSectionId: uuid('scope_section_id'),
  graceDays: integer('grace_days').default(0).notNull(),
  formula: varchar({ length: 20 }).default('flat').notNull(),
  flatAmount: numeric('flat_amount', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  perDayAmount: numeric('per_day_amount', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  maxAmount: numeric('max_amount', { precision: 14, scale: 2, mode: 'number' }),
  effectiveFrom: date('effective_from').defaultNow().notNull(),
  effectiveTo: date('effective_to'),
  status: varchar({ length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fine_policies_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.scopeClassId],
    foreignColumns: [classes.id],
    name: 'fine_policies_scope_class_id_classes_id_fk',
  }),
  foreignKey({
    columns: [table.scopeSectionId],
    foreignColumns: [classSections.id],
    name: 'fine_policies_scope_section_id_class_sections_id_fk',
  }),
  index('fine_policies_tenant_status_idx').on(table.tenantId, table.status),
]);

export const fineAssessments = pgTable('fine_assessments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  finePolicyId: uuid('fine_policy_id').notNull(),
  invoiceId: uuid('invoice_id'),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  reason: text(),
  status: varchar({ length: 20 }).default('assessed').notNull(),
  waivedAmount: numeric('waived_amount', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  waiveReason: text('waive_reason'),
  waiveById: text('waive_by_id'),
  assessedAt: timestamp('assessed_at', { mode: 'string' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fine_assessments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'fine_assessments_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.finePolicyId],
    foreignColumns: [finePolicies.id],
    name: 'fine_assessments_fine_policy_id_fine_policies_id_fk',
  }),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [invoices.id],
    name: 'fine_assessments_invoice_id_invoices_id_fk',
  }),
  index('fine_assessments_tenant_student_idx').on(table.tenantId, table.studentId),
]);

export const invoiceEvents = pgTable('invoice_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  invoiceId: uuid('invoice_id').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  payload: jsonb(),
  actorUserId: text('actor_user_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'invoice_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [invoices.id],
    name: 'invoice_events_invoice_id_invoices_id_fk',
  }).onDelete('cascade'),
  index('invoice_events_tenant_invoice_idx').on(table.tenantId, table.invoiceId),
]);

export const paymentReversals = pgTable('payment_reversals', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  paymentId: uuid('payment_id').notNull(),
  reason: text(),
  status: varchar({ length: 20 }).default('draft').notNull(),
  reversedById: text('reversed_by_id'),
  approvedById: text('approved_by_id'),
  rejectionReason: text('rejection_reason'),
  reversedAt: timestamp('reversed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'payment_reversals_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.paymentId],
    foreignColumns: [payments.id],
    name: 'payment_reversals_payment_id_payments_id_fk',
  }).onDelete('cascade'),
  index('payment_reversals_tenant_payment_idx').on(table.tenantId, table.paymentId),
]);

export const studentCredits = pgTable('student_credits', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  balance: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  source: varchar({ length: 30 }).default('manual').notNull(),
  note: text(),
  createdById: text('created_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'student_credits_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'student_credits_student_id_user_id_fk',
  }).onDelete('cascade'),
  index('student_credits_tenant_student_idx').on(table.tenantId, table.studentId),
]);

export const cashierClosings = pgTable('cashier_closings', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  cashierSessionId: uuid('cashier_session_id').notNull(),
  cashierId: text('cashier_id').notNull(),
  expectedCash: numeric('expected_cash', { precision: 14, scale: 2, mode: 'number' }).notNull(),
  actualCash: numeric('actual_cash', { precision: 14, scale: 2, mode: 'number' }).notNull(),
  variance: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  notes: text(),
  closedById: text('closed_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'cashier_closings_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.cashierSessionId],
    foreignColumns: [cashierSessions.id],
    name: 'cashier_closings_cashier_session_id_cashier_sessions_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.cashierId],
    foreignColumns: [user.id],
    name: 'cashier_closings_cashier_id_user_id_fk',
  }).onDelete('cascade'),
  index('cashier_closings_tenant_session_idx').on(table.tenantId, table.cashierSessionId),
]);

export const financeReminderRules = pgTable('finance_reminder_rules', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar({ length: 255 }).notNull(),
  timing: varchar({ length: 10 }).default('after').notNull(),
  daysRelative: integer('days_relative').default(0).notNull(),
  cadenceDays: integer('cadence_days').default(0).notNull(),
  minBalance: numeric('min_balance', { precision: 14, scale: 2, mode: 'number' }).default(0).notNull(),
  maxPerStudent: integer('max_per_student').default(3).notNull(),
  quietStart: varchar('quiet_start', { length: 5 }),
  quietEnd: varchar('quiet_end', { length: 5 }),
  locale: varchar({ length: 10 }).default('fr').notNull(),
  escalationLevel: integer('escalation_level').default(1).notNull(),
  status: varchar({ length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'finance_reminder_rules_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  index('finance_reminder_rules_tenant_status_idx').on(table.tenantId, table.status),
]);

export const financeReminderRuns = pgTable('finance_reminder_runs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  ruleId: uuid('rule_id').notNull(),
  runDate: date('run_date').defaultNow().notNull(),
  status: varchar({ length: 20 }).default('running').notNull(),
  recipientsCount: integer('recipients_count').default(0).notNull(),
  sentCount: integer('sent_count').default(0).notNull(),
  results: jsonb(),
  startedById: text('started_by_id'),
  startedAt: timestamp('started_at', { mode: 'string' }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { mode: 'string' }),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'finance_reminder_runs_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.ruleId],
    foreignColumns: [financeReminderRules.id],
    name: 'finance_reminder_runs_rule_id_finance_reminder_rules_id_fk',
  }),
  index('finance_reminder_runs_tenant_rule_idx').on(table.tenantId, table.ruleId),
]);

export const paymentMethodConfigurations = pgTable('payment_method_configurations', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  methodCode: varchar('method_code', { length: 50 }).notNull(),
  labelFr: varchar('label_fr', { length: 255 }).notNull(),
  labelAr: varchar('label_ar', { length: 255 }),
  requiresReference: boolean('requires_reference').default(false).notNull(),
  requiresBank: boolean('requires_bank').default(false).notNull(),
  requiresDate: boolean('requires_date').default(false).notNull(),
  requiresProof: boolean('requires_proof').default(false).notNull(),
  refundable: boolean().default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  branchScopeId: uuid('branch_scope_id'),
  accountingAccountId: uuid('accounting_account_id'),
  provider: varchar('provider', { length: 30 }),
  gatewayMode: varchar('gateway_mode', { length: 10 }).default('sandbox'),
  credentialSecretKey: varchar('credential_secret_key', { length: 128 }),
  webhookSecretKey: varchar('webhook_secret_key', { length: 128 }),
  effectiveFrom: date('effective_from').defaultNow().notNull(),
  effectiveTo: date('effective_to'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'payment_method_configurations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  index('payment_method_configurations_tenant_code_idx').on(table.tenantId, table.methodCode),
]);

export const paymentGatewaySessions = pgTable('payment_gateway_sessions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  invoiceId: uuid('invoice_id').notNull(),
  paymentId: uuid('payment_id'),
  methodCode: varchar('method_code', { length: 50 }).notNull(),
  provider: varchar('provider', { length: 30 }).notNull(),
  externalReference: varchar('external_reference', { length: 100 }),
  amount: numeric('amount', { precision: 14, scale: 2, mode: 'number' }).notNull(),
  currency: varchar('currency', { length: 3 }).default('MAD').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  mode: varchar('mode', { length: 10 }).default('sandbox').notNull(),
  rawCallback: jsonb('raw_callback'),
  expiresAt: timestamp('expires_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'payment_gateway_sessions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [invoices.id],
    name: 'payment_gateway_sessions_invoice_id_invoices_id_fk',
  }).onDelete('cascade'),
  index('payment_gateway_sessions_tenant_ext_idx').on(table.tenantId, table.externalReference),
  index('payment_gateway_sessions_tenant_status_idx').on(table.tenantId, table.status),
]);

export const feeStructureVersions = pgTable('fee_structure_versions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  feeStructureId: uuid('fee_structure_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  status: varchar({ length: 20 }).default('draft').notNull(),
  publishedById: text('published_by_id'),
  publishedAt: timestamp('published_at', { mode: 'string' }),
  componentsSnapshot: jsonb('components_snapshot'),
  effectiveFrom: date('effective_from'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fee_structure_versions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.feeStructureId],
    foreignColumns: [feeStructures.id],
    name: 'fee_structure_versions_fee_structure_id_fee_structures_id_fk',
  }).onDelete('cascade'),
  index('fee_structure_versions_tenant_structure_idx').on(table.tenantId, table.feeStructureId),
]);

export const feeAllocationRuns = pgTable('fee_allocation_runs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  period: varchar({ length: 20 }).notNull(),
  feeStructureVersionId: uuid('fee_structure_version_id'),
  feeScheduleId: uuid('fee_schedule_id'),
  branchId: uuid('branch_id'),
  dueDate: date('due_date'),
  status: varchar({ length: 20 }).default('draft').notNull(),
  previewSummary: jsonb('preview_summary'),
  runById: text('run_by_id'),
  approvedById: text('approved_by_id'),
  approvedAt: timestamp('approved_at', { mode: 'string' }),
  cancelledById: text('cancelled_by_id'),
  cancelledAt: timestamp('cancelled_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { mode: 'string' }),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fee_allocation_runs_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.feeStructureVersionId],
    foreignColumns: [feeStructureVersions.id],
    name: 'fee_allocation_runs_fee_structure_version_id_fk',
  }),
  foreignKey({
    columns: [table.feeScheduleId],
    foreignColumns: [feeSchedules.id],
    name: 'fee_allocation_runs_fee_schedule_id_fee_schedules_id_fk',
  }),
  foreignKey({
    columns: [table.branchId],
    foreignColumns: [branches.id],
    name: 'fee_allocation_runs_branch_id_branches_id_fk',
  }),
  index('fee_allocation_runs_tenant_status_idx').on(table.tenantId, table.status),
]);

export const feeAllocationTargets = pgTable('fee_allocation_targets', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  runId: uuid('run_id').notNull(),
  studentId: text('student_id').notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  status: varchar({ length: 20 }).default('pending').notNull(),
  reason: text(),
  invoiceId: uuid('invoice_id'),
  error: text(),
  processedAt: timestamp('processed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'fee_allocation_targets_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.runId],
    foreignColumns: [feeAllocationRuns.id],
    name: 'fee_allocation_targets_run_id_fee_allocation_runs_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'fee_allocation_targets_student_id_user_id_fk',
  }).onDelete('cascade'),
  index('fee_allocation_targets_tenant_run_idx').on(table.tenantId, table.runId),
]);

// Persisted receipts (Phase D): one row per cash/check/card/transfer collection,
// number issued atomically via consumeDocumentNumber (prefix RC-{year}-).
// allocations stores the payment_allocations breakdown as jsonb, so a split
// multi-invoice collection is fully reproducible from the single receipt.
export const receipts = pgTable('receipts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  receiptNumber: varchar('receipt_number', { length: 50 }).notNull(),
  studentId: text('student_id').notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  paymentDate: date('payment_date').notNull(),
  allocations: jsonb().notNull().default([]),
  createdById: text('created_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'receipts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'receipts_student_id_user_id_fk',
  }).onDelete('cascade'),
  index('receipts_tenant_student_idx').on(table.tenantId, table.studentId),
]);
