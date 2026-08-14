// Payroll & Workforce Operations add-on schema.
//
// Follows the feature-schema pattern used by hr-schema: shared types (tenants,
// user, branches, employeeProfiles, salaryComponents, salaryTemplates,
// payrollPeriods, payrollRunLines, leaveCategories) are imported from
// '@/models/Schema' and this file is re-exported by the Schema.ts barrel.
// Drizzle FK callbacks are lazy, so the circular import resolves.
//
// All money columns are numeric(12,2) with mode 'string' so the exact
// cent-based helpers in @/libs/finance/money can process them without float
// drift. Every table is tenant-scoped; employee/actor/policy/run links are
// tenant-consistent and enforced at the service layer plus FKs.
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  employeeProfiles,
  leaveCategories,
  payrollPeriods,
  payrollRunLines,
  salaryAdvances,
  salaryComponents,
  salaryTemplates,
  tenants,
  user,
} from '@/models/Schema';

const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: 'string' });

// ---------------------------------------------------------------------------
// Effective-dated regulation packs & versions
// ---------------------------------------------------------------------------

export const payrollRegulationPacks = pgTable('payroll_regulation_packs', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  jurisdiction: varchar('jurisdiction', { length: 2 }).default('MA').notNull(), // ISO 3166-1 alpha-2
  code: varchar('code', { length: 40 }).notNull(), // e.g. MA-2024
  name: varchar('name', { length: 160 }).notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft | published | retired
  sourceUrl: text('source_url'),
  sourceDocumentRef: text('source_document_ref'), // CGI/loi de finances/circulaire reference
  publicationDate: date('publication_date'),
  validationStatus: varchar('validation_status', { length: 30 }).default('unvalidated').notNull(), // unvalidated | under_review | validated_by_professional
  validatedById: text('validated_by_id'),
  validatedAt: timestamp('validated_at', { mode: 'string' }),
  reviewerNotes: text('reviewer_notes'),
  notes: text('notes'),
  createdById: text('created_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'payroll_regulation_packs_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.validatedById], foreignColumns: [user.id], name: 'payroll_regulation_packs_validated_by_id_user_id_fk' }).onDelete('set null'),
  foreignKey({ columns: [table.createdById], foreignColumns: [user.id], name: 'payroll_regulation_packs_created_by_id_user_id_fk' }).onDelete('set null'),
  unique('payroll_regulation_packs_tenant_code_unique').on(table.tenantId, table.code),
]);

export const payrollRegulationVersions = pgTable('payroll_regulation_versions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  packId: uuid('pack_id').notNull(),
  versionLabel: varchar('version_label', { length: 40 }).notNull(), // e.g. MA-2024.1
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft | published | retired
  /**
   * Full statutory rule set for the jurisdiction/period. Shape is owned by the
   * jurisdiction adapter (see services/ma-regulation-adapter.ts); never eval'd.
   */
  ruleConfig: jsonb('rule_config').notNull(),
  roundingOrder: jsonb('rounding_order').notNull(), // ordered stage list, e.g. [{key:'cnss_employee',round:'half_up',places:2}, ...]
  monthlyDefault: boolean('monthly_default').default(false).notNull(),
  publishedAt: timestamp('published_at', { mode: 'string' }),
  publishedById: text('published_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'payroll_regulation_versions_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.packId], foreignColumns: [payrollRegulationPacks.id], name: 'payroll_regulation_versions_pack_id_pack_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.publishedById], foreignColumns: [user.id], name: 'payroll_regulation_versions_published_by_id_user_id_fk' }).onDelete('set null'),
  unique('payroll_regulation_versions_tenant_pack_effective_unique').on(table.tenantId, table.packId, table.effectiveFrom),
]);

// ---------------------------------------------------------------------------
// Payroll settings (versioned, immutable once published)
// ---------------------------------------------------------------------------

export const payrollSettingsVersions = pgTable('payroll_settings_versions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  versionNo: integer('version_no').notNull(),
  settings: jsonb('settings').notNull(), // currency, pay frequency, cut-off, payment day, default rounding, employer CNSS id, accounting mappings
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft | published
  publishedAt: timestamp('published_at', { mode: 'string' }),
  publishedById: text('published_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'payroll_settings_versions_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.publishedById], foreignColumns: [user.id], name: 'payroll_settings_versions_published_by_id_user_id_fk' }).onDelete('set null'),
  unique('payroll_settings_versions_tenant_version_unique').on(table.tenantId, table.versionNo),
]);

// ---------------------------------------------------------------------------
// Versioned salary components & structures
// ---------------------------------------------------------------------------

export const salaryComponentVersions = pgTable('salary_component_versions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  componentId: uuid('component_id').notNull(),
  versionNo: integer('version_no').notNull(),
  code: varchar('code', { length: 40 }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  componentType: varchar('component_type', { length: 20 }).notNull(), // earning | deduction | employer | info
  valueType: varchar('value_type', { length: 20 }).notNull(), // fixed | percent | formula
  fixedValue: money('fixed_value'),
  percentOf: varchar('percent_of', { length: 40 }), // allowlisted base key, e.g. base_salary | taxable_gross
  percentBp: integer('percent_bp'), // basis points (1% = 100) when valueType = percent
  formula: text('formula'), // typed allowlisted expression (expression-engine grammar)
  taxable: boolean('taxable').default(true).notNull(),
  contributable: boolean('contributable').default(true).notNull(),
  side: varchar('side', { length: 20 }).notNull(), // employee | employer | info
  proratable: boolean('proratable').default(true).notNull(),
  recurring: boolean('recurring').default(true).notNull(),
  roundingMode: varchar('rounding_mode', { length: 20 }).default('half_up').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft | published | retired
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),
  publishedAt: timestamp('published_at', { mode: 'string' }),
  publishedById: text('published_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'salary_component_versions_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.componentId], foreignColumns: [salaryComponents.id], name: 'salary_component_versions_component_id_components_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.publishedById], foreignColumns: [user.id], name: 'salary_component_versions_published_by_id_user_id_fk' }).onDelete('set null'),
  unique('salary_component_versions_tenant_component_version_unique').on(table.tenantId, table.componentId, table.versionNo),
]);

export const salaryStructureVersions = pgTable('salary_structure_versions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  templateId: uuid('template_id').notNull(),
  versionNo: integer('version_no').notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft | reviewed | published | retired
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),
  publishedAt: timestamp('published_at', { mode: 'string' }),
  publishedById: text('published_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'salary_structure_versions_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.templateId], foreignColumns: [salaryTemplates.id], name: 'salary_structure_versions_template_id_templates_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.publishedById], foreignColumns: [user.id], name: 'salary_structure_versions_published_by_id_user_id_fk' }).onDelete('set null'),
  unique('salary_structure_versions_tenant_template_version_unique').on(table.tenantId, table.templateId, table.versionNo),
]);

export const salaryStructureComponents = pgTable('salary_structure_components', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  structureVersionId: uuid('structure_version_id').notNull(),
  componentId: uuid('component_id').notNull(),
  componentVersionId: uuid('component_version_id').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  baseValue: money('base_value'), // optional override of the component's fixed value for this structure
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'salary_structure_components_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.structureVersionId], foreignColumns: [salaryStructureVersions.id], name: 'salary_structure_components_structure_version_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.componentId], foreignColumns: [salaryComponents.id], name: 'salary_structure_components_component_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.componentVersionId], foreignColumns: [salaryComponentVersions.id], name: 'salary_structure_components_component_version_fk' }).onDelete('cascade'),
  unique('salary_structure_components_version_component_unique').on(table.structureVersionId, table.componentId),
]);

// ---------------------------------------------------------------------------
// Restricted employee payroll profiles (bank/CNSS/tax), one per employee
// ---------------------------------------------------------------------------

export const employeePayrollProfiles = pgTable('employee_payroll_profiles', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  userId: text('user_id'),
  cnssNumber: varchar('cnss_number', { length: 40 }),
  amoNumber: varchar('amo_number', { length: 40 }),
  taxId: varchar('tax_id', { length: 40 }),
  bankRibEncrypted: text('bank_rib_encrypted'),
  bankName: varchar('bank_name', { length: 160 }),
  bankAccountName: varchar('bank_account_name', { length: 160 }),
  dependantsCount: integer('dependants_count').default(0).notNull(),
  payFrequency: varchar('pay_frequency', { length: 20 }).default('monthly').notNull(),
  paymentMethod: varchar('payment_method', { length: 20 }).default('bank').notNull(), // bank | cash | cheque
  salaryCurrency: varchar('salary_currency', { length: 3 }).default('MAD').notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'employee_payroll_profiles_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.employeeId], foreignColumns: [employeeProfiles.id], name: 'employee_payroll_profiles_employee_id_profiles_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: 'employee_payroll_profiles_user_id_user_id_fk' }).onDelete('set null'),
  unique('employee_payroll_profiles_tenant_employee_unique').on(table.tenantId, table.employeeId),
]);

// ---------------------------------------------------------------------------
// One-off & recurring payroll adjustments
// ---------------------------------------------------------------------------

export const payrollAdjustments = pgTable('payroll_adjustments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  userId: text('user_id').notNull(),
  periodId: uuid('period_id'),
  adjustmentType: varchar('adjustment_type', { length: 30 }).notNull(), // bonus | overtime | award | correction | reimbursement | deduction | recovery
  componentId: uuid('component_id'),
  amount: money('amount'),
  units: numeric('units', { precision: 12, scale: 2, mode: 'string' }),
  rate: money('rate'),
  reason: text('reason'),
  evidenceKey: text('evidence_key'),
  taxTreatment: varchar('tax_treatment', { length: 30 }).default('component').notNull(), // component | taxable | non_taxable
  recurring: boolean('recurring').default(false).notNull(),
  recurrenceStart: date('recurrence_start'),
  recurrenceEnd: date('recurrence_end'),
  remainingOccurrences: integer('remaining_occurrences'),
  effectivePeriodYear: integer('effective_period_year').notNull(),
  effectivePeriodMonth: integer('effective_period_month').notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft | submitted | approved | rejected | cancelled
  requesterId: text('requester_id'),
  approverId: text('approver_id'),
  approvedAt: timestamp('approved_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'payroll_adjustments_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.employeeId], foreignColumns: [employeeProfiles.id], name: 'payroll_adjustments_employee_id_profiles_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: 'payroll_adjustments_user_id_user_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.periodId], foreignColumns: [payrollPeriods.id], name: 'payroll_adjustments_period_id_periods_id_fk' }).onDelete('set null'),
  foreignKey({ columns: [table.componentId], foreignColumns: [salaryComponents.id], name: 'payroll_adjustments_component_id_components_id_fk' }).onDelete('set null'),
  foreignKey({ columns: [table.requesterId], foreignColumns: [user.id], name: 'payroll_adjustments_requester_id_user_id_fk' }).onDelete('set null'),
  foreignKey({ columns: [table.approverId], foreignColumns: [user.id], name: 'payroll_adjustments_approver_id_user_id_fk' }).onDelete('set null'),
]);

// ---------------------------------------------------------------------------
// Componentized results & deterministic calculation traces
// ---------------------------------------------------------------------------

export const payrollResultLines = pgTable('payroll_result_lines', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  runId: uuid('run_id').notNull(), // == payroll_periods.id (period doubles as the run)
  userId: text('user_id').notNull(),
  lineCode: varchar('line_code', { length: 40 }).notNull(),
  componentId: uuid('component_id'),
  componentVersionId: uuid('component_version_id'),
  label: varchar('label', { length: 160 }).notNull(),
  lineType: varchar('line_type', { length: 20 }).notNull(), // earning | deduction | employer | info
  amount: money('amount').notNull(),
  base: money('base'),
  rate: money('rate'),
  quantity: numeric('quantity', { precision: 12, scale: 2, mode: 'string' }),
  formulaVersion: varchar('formula_version', { length: 40 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'payroll_result_lines_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.runId], foreignColumns: [payrollPeriods.id], name: 'payroll_result_lines_run_id_periods_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: 'payroll_result_lines_user_id_user_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.componentId], foreignColumns: [salaryComponents.id], name: 'payroll_result_lines_component_id_components_id_fk' }).onDelete('set null'),
  foreignKey({ columns: [table.componentVersionId], foreignColumns: [salaryComponentVersions.id], name: 'payroll_result_lines_component_version_fk' }).onDelete('set null'),
  unique('payroll_result_lines_run_user_code_unique').on(table.runId, table.userId, table.lineCode),
  index('payroll_result_lines_run_user_idx').on(table.runId, table.userId),
]);

export const payrollCalculationTraces = pgTable('payroll_calculation_traces', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  runId: uuid('run_id').notNull(),
  userId: text('user_id').notNull(),
  version: integer('version').default(1).notNull(),
  regulationVersionId: uuid('regulation_version_id'),
  /** Deterministic, ordered computation steps (inputs, bases, rates, rounding). */
  trace: jsonb('trace').notNull(),
  inputSnapshot: jsonb('input_snapshot').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'payroll_calculation_traces_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.runId], foreignColumns: [payrollPeriods.id], name: 'payroll_calculation_traces_run_id_periods_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: 'payroll_calculation_traces_user_id_user_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.regulationVersionId], foreignColumns: [payrollRegulationVersions.id], name: 'payroll_calculation_traces_regulation_version_fk' }).onDelete('set null'),
  unique('payroll_calculation_traces_run_user_version_unique').on(table.runId, table.userId, table.version),
]);

// ---------------------------------------------------------------------------
// Accounting posting references (payload-bound idempotency)
// ---------------------------------------------------------------------------

export const payrollPostings = pgTable('payroll_postings', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  runId: uuid('run_id').notNull(),
  journalEntryId: uuid('journal_entry_id'),
  postingRequestId: uuid('posting_request_id'),
  payloadDigest: text('payload_digest').notNull(),
  sourceVersion: integer('source_version').notNull(),
  postingType: varchar('posting_type', { length: 20 }).notNull(), // accrual | settlement | reversal
  status: varchar('status', { length: 20 }).default('processing').notNull(), // processing | succeeded | failed | reversed
  idempotencyKey: varchar('idempotency_key', { length: 120 }).notNull(),
  fiscalPeriodId: uuid('fiscal_period_id'),
  postedById: text('posted_by_id'),
  postedAt: timestamp('posted_at', { mode: 'string' }),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'payroll_postings_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.runId], foreignColumns: [payrollPeriods.id], name: 'payroll_postings_run_id_periods_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.postedById], foreignColumns: [user.id], name: 'payroll_postings_posted_by_id_user_id_fk' }).onDelete('set null'),
  unique('payroll_postings_tenant_idempotency_unique').on(table.tenantId, table.idempotencyKey),
]);

export const payrollPostingLines = pgTable('payroll_posting_lines', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  postingId: uuid('posting_id').notNull(),
  accountId: uuid('account_id').notNull(),
  debitAmount: money('debit_amount').notNull(),
  creditAmount: money('credit_amount').notNull(),
  memo: text('memo'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'payroll_posting_lines_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.postingId], foreignColumns: [payrollPostings.id], name: 'payroll_posting_lines_posting_id_postings_id_fk' }).onDelete('cascade'),
]);

// ---------------------------------------------------------------------------
// Payment batches & payments (double-payment prevention by unique run line)
// ---------------------------------------------------------------------------

export const salaryPaymentBatches = pgTable('salary_payment_batches', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  runId: uuid('run_id').notNull(),
  method: varchar('method', { length: 20 }).notNull(), // bank | cash | cheque
  status: varchar('status', { length: 30 }).default('prepared').notNull(), // prepared | approved | exported | submitted | partially_paid | paid | failed | reversed
  totalAmount: money('total_amount').notNull(),
  preparedById: text('prepared_by_id').notNull(),
  approvedById: text('approved_by_id'),
  approvedAt: timestamp('approved_at', { mode: 'string' }),
  exportedAt: timestamp('exported_at', { mode: 'string' }),
  exportFormat: varchar('export_format', { length: 30 }), // damancom | bank_sepa | bank_custom | none (adapters disabled until certified)
  exportFileKey: text('export_file_key'),
  reconciliationStatus: varchar('reconciliation_status', { length: 20 }).default('none').notNull(), // none | partial | reconciled
  reconciledById: text('reconciled_by_id'),
  reconciledAt: timestamp('reconciled_at', { mode: 'string' }),
  reversedById: text('reversed_by_id'),
  reversedAt: timestamp('reversed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'salary_payment_batches_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.runId], foreignColumns: [payrollPeriods.id], name: 'salary_payment_batches_run_id_periods_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.preparedById], foreignColumns: [user.id], name: 'salary_payment_batches_prepared_by_id_user_id_fk' }).onDelete('restrict'),
  foreignKey({ columns: [table.approvedById], foreignColumns: [user.id], name: 'salary_payment_batches_approved_by_id_user_id_fk' }).onDelete('set null'),
  foreignKey({ columns: [table.reconciledById], foreignColumns: [user.id], name: 'salary_payment_batches_reconciled_by_id_user_id_fk' }).onDelete('set null'),
  foreignKey({ columns: [table.reversedById], foreignColumns: [user.id], name: 'salary_payment_batches_reversed_by_id_user_id_fk' }).onDelete('set null'),
]);

export const salaryPayments = pgTable('salary_payments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  batchId: uuid('batch_id').notNull(),
  runLineId: uuid('run_line_id').notNull(), // one payment per posted run line (double-payment prevention)
  userId: text('user_id').notNull(),
  amount: money('amount').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | paid | failed | reversed
  bankReference: text('bank_reference'),
  receiptReference: text('receipt_reference'),
  maskedBankDetails: text('masked_bank_details'),
  paidById: text('paid_by_id'),
  paidAt: timestamp('paid_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'salary_payments_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.batchId], foreignColumns: [salaryPaymentBatches.id], name: 'salary_payments_batch_id_batches_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.runLineId], foreignColumns: [payrollRunLines.id], name: 'salary_payments_run_line_id_run_lines_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: 'salary_payments_user_id_user_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.paidById], foreignColumns: [user.id], name: 'salary_payments_paid_by_id_user_id_fk' }).onDelete('set null'),
  unique('salary_payments_tenant_run_line_unique').on(table.tenantId, table.runLineId),
]);

// ---------------------------------------------------------------------------
// Leave policies, assignments & append-only balance ledger
// ---------------------------------------------------------------------------

export const employeeLeavePolicies = pgTable('employee_leave_policies', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  categoryId: uuid('category_id').notNull(),
  accrualType: varchar('accrual_type', { length: 20 }).default('annual').notNull(), // annual | front_loaded | monthly
  annualDays: numeric('annual_days', { precision: 6, scale: 2, mode: 'string' }),
  monthlyAccrualDays: numeric('monthly_accrual_days', { precision: 6, scale: 2, mode: 'string' }),
  carryoverLimit: numeric('carryover_limit', { precision: 6, scale: 2, mode: 'string' }),
  maxBalance: numeric('max_balance', { precision: 6, scale: 2, mode: 'string' }),
  allowNegative: boolean('allow_negative').default(false).notNull(),
  probationRestrictionDays: integer('probation_restriction_days').default(0).notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'employee_leave_policies_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.categoryId], foreignColumns: [leaveCategories.id], name: 'employee_leave_policies_category_id_categories_id_fk' }).onDelete('restrict'),
]);

export const employeeLeavePolicyAssignments = pgTable('employee_leave_policy_assignments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  policyId: uuid('policy_id').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'employee_leave_policy_assignments_tenant_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.employeeId], foreignColumns: [employeeProfiles.id], name: 'employee_leave_policy_assignments_employee_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.policyId], foreignColumns: [employeeLeavePolicies.id], name: 'employee_leave_policy_assignments_policy_fk' }).onDelete('cascade'),
  unique('employee_leave_policy_assignments_employee_effective_unique').on(table.tenantId, table.employeeId, table.effectiveFrom),
]);

export const employeeLeaveBalanceTransactions = pgTable('employee_leave_balance_transactions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  userId: text('user_id'),
  categoryId: uuid('category_id').notNull(),
  policyId: uuid('policy_id'),
  year: integer('year').notNull(),
  txType: varchar('tx_type', { length: 30 }).notNull(), // allocation | accrual | adjustment | reservation | consumption | cancellation | release | expiry | carryover
  units: numeric('units', { precision: 8, scale: 2, mode: 'string' }).notNull(),
  refType: varchar('ref_type', { length: 40 }),
  refId: uuid('ref_id'),
  occurredAt: timestamp('occurred_at', { mode: 'string' }).defaultNow().notNull(),
  createdById: text('created_by_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'employee_leave_balance_tx_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.employeeId], foreignColumns: [employeeProfiles.id], name: 'employee_leave_balance_tx_employee_id_profiles_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: 'employee_leave_balance_tx_user_id_user_id_fk' }).onDelete('set null'),
  foreignKey({ columns: [table.categoryId], foreignColumns: [leaveCategories.id], name: 'employee_leave_balance_tx_category_id_categories_id_fk' }).onDelete('restrict'),
  foreignKey({ columns: [table.policyId], foreignColumns: [employeeLeavePolicies.id], name: 'employee_leave_balance_tx_policy_id_policies_id_fk' }).onDelete('set null'),
  index('employee_leave_balance_tx_employee_year_idx').on(table.tenantId, table.employeeId, table.year),
]);

// ---------------------------------------------------------------------------
// Salary advance policies & repayment schedules
// ---------------------------------------------------------------------------

export const salaryAdvancePolicies = pgTable('salary_advance_policies', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  maxAmount: money('max_amount'),
  maxOutstanding: money('max_outstanding'),
  minEmploymentMonths: integer('min_employment_months').default(0).notNull(),
  repaymentStartMonths: integer('repayment_start_months').default(1).notNull(),
  maxInstallments: integer('max_installments').default(6).notNull(),
  minNetProtection: money('min_net_protection'),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'salary_advance_policies_tenant_id_tenants_id_fk' }).onDelete('cascade'),
]);

export const salaryAdvanceRepaymentSchedules = pgTable('salary_advance_repayment_schedules', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  advanceId: uuid('advance_id').notNull(),
  installmentNo: integer('installment_no').notNull(),
  duePeriodYear: integer('due_period_year').notNull(),
  duePeriodMonth: integer('due_period_month').notNull(),
  amount: money('amount').notNull(),
  status: varchar('status', { length: 20 }).default('scheduled').notNull(), // scheduled | recovering | paid | skipped | reversed
  payrollRunLineId: uuid('payroll_run_line_id'), // set only when recovered from a posted run (double-recovery prevention)
  allocatedAt: timestamp('allocated_at', { mode: 'string' }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'salary_advance_repay_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.advanceId], foreignColumns: [salaryAdvances.id], name: 'salary_advance_repay_advance_id_advances_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.payrollRunLineId], foreignColumns: [payrollRunLines.id], name: 'salary_advance_repay_run_line_id_run_lines_id_fk' }).onDelete('set null'),
  unique('salary_advance_repay_advance_installment_unique').on(table.tenantId, table.advanceId, table.installmentNo),
  unique('salary_advance_repay_run_line_unique').on(table.payrollRunLineId),
]);

// ---------------------------------------------------------------------------
// Award definitions (grants live in employee_awards, backfilled by 0092)
// ---------------------------------------------------------------------------

export const awardDefinitions = pgTable('award_definitions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // excellence | innovation | tenure | leadership | teamwork | custom
  description: text('description'),
  eligibility: text('eligibility'),
  approvalRequired: boolean('approval_required').default(true).notNull(),
  monetaryDefault: money('monetary_default'),
  monetaryComponentId: uuid('monetary_component_id'), // one-off payroll earning on grant
  visibility: varchar('visibility', { length: 20 }).default('internal').notNull(), // internal | public | private
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id], name: 'award_definitions_tenant_id_tenants_id_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.monetaryComponentId], foreignColumns: [salaryComponents.id], name: 'award_definitions_monetary_component_id_components_fk' }).onDelete('set null'),
]);

// Re-exported types
export type PayrollRegulationVersion = typeof payrollRegulationVersions.$inferSelect;
export type PayrollResultLine = typeof payrollResultLines.$inferSelect;
export type SalaryPayment = typeof salaryPayments.$inferSelect;
export type SalaryAdvanceRepaymentSchedule = typeof salaryAdvanceRepaymentSchedules.$inferSelect;
export type EmployeeLeaveBalanceTransaction = typeof employeeLeaveBalanceTransactions.$inferSelect;
