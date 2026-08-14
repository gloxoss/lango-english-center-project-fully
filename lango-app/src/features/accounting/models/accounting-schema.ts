import { boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
// Defined locally to avoid an eager circular import (this file is re-exported by
// the @/models/Schema barrel). Must match Schema.ts's account_type enum.
const accountType = pgEnum('account_type', ['asset', 'liability', 'equity', 'revenue', 'expense']);

export const accountingJournals = pgTable('accounting_journals', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  code: varchar({ length: 20 }).notNull(),
  name: varchar({ length: 160 }).notNull(),
  journalType: varchar('journal_type', { length: 30 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_journals_tenant_code_unique').on(table.tenantId, table.code),
  unique('accounting_journals_tenant_id_unique').on(table.tenantId, table.id),
  index('accounting_journals_tenant_type_idx').on(table.tenantId, table.journalType),
]);

export const accountingVoucherTypes = pgTable('accounting_voucher_types', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  journalId: uuid('journal_id').notNull(),
  code: varchar({ length: 30 }).notNull(),
  name: varchar({ length: 160 }).notNull(),
  sourceModule: varchar('source_module', { length: 60 }),
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_voucher_types_tenant_code_unique').on(table.tenantId, table.code),
  unique('accounting_voucher_types_tenant_id_unique').on(table.tenantId, table.id),
  index('accounting_voucher_types_tenant_journal_idx').on(table.tenantId, table.journalId),
]);

export const accountingNumberingSeries = pgTable('accounting_numbering_series', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  journalId: uuid('journal_id').notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  prefix: varchar({ length: 30 }).notNull(),
  nextValue: integer('next_value').default(1).notNull(),
  padding: integer().default(6).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_numbering_tenant_journal_year_unique').on(table.tenantId, table.journalId, table.fiscalYear),
]);

export const accountingPostingRequests = pgTable('accounting_posting_requests', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sourceModule: varchar('source_module', { length: 60 }).notNull(),
  sourceDocumentId: text('source_document_id').notNull(),
  sourceVersion: integer('source_version').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
  payloadDigest: varchar('payload_digest', { length: 64 }).notNull(),
  status: varchar({ length: 20 }).default('processing').notNull(),
  journalEntryId: uuid('journal_entry_id'),
  errorCode: varchar('error_code', { length: 80 }),
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { mode: 'string' }),
}, table => [
  unique('accounting_posting_requests_tenant_key_unique').on(table.tenantId, table.idempotencyKey),
  unique('accounting_posting_requests_source_version_unique').on(table.tenantId, table.sourceModule, table.sourceDocumentId, table.sourceVersion),
  unique('accounting_posting_requests_tenant_id_unique').on(table.tenantId, table.id),
  index('accounting_posting_requests_tenant_status_idx').on(table.tenantId, table.status),
]);

export const accountingJournalLinks = pgTable('accounting_journal_links', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  journalEntryId: uuid('journal_entry_id').notNull(),
  journalId: uuid('journal_id').notNull(),
  voucherTypeId: uuid('voucher_type_id').notNull(),
  postingRequestId: uuid('posting_request_id').notNull(),
  reversalOfEntryId: uuid('reversal_of_entry_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_journal_links_entry_unique').on(table.journalEntryId),
  unique('accounting_journal_links_request_unique').on(table.postingRequestId),
  unique('accounting_journal_links_reversal_unique').on(table.reversalOfEntryId),
  index('accounting_journal_links_tenant_journal_idx').on(table.tenantId, table.journalId),
]);

export const accountingVoucherEvents = pgTable('accounting_voucher_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  journalEntryId: uuid('journal_entry_id').notNull(),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  actorId: text('actor_id').notNull(),
  reason: text(),
  metadata: jsonb().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('accounting_voucher_events_tenant_entry_idx').on(table.tenantId, table.journalEntryId, table.createdAt),
]);

export const accountingDocuments = pgTable('accounting_documents', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  documentType: varchar('document_type', { length: 30 }).notNull(),
  status: varchar({ length: 30 }).default('draft').notNull(),
  documentDate: date('document_date').notNull(),
  reference: varchar({ length: 160 }),
  counterparty: varchar({ length: 255 }),
  description: text().notNull(),
  currency: varchar({ length: 10 }).default('MAD').notNull(),
  totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull(),
  sourceVersion: integer('source_version').default(1).notNull(),
  createdById: text('created_by_id').notNull(),
  approvedById: text('approved_by_id'),
  journalEntryId: uuid('journal_entry_id'),
  submittedAt: timestamp('submitted_at', { mode: 'string' }),
  approvedAt: timestamp('approved_at', { mode: 'string' }),
  postedAt: timestamp('posted_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_documents_tenant_id_unique').on(table.tenantId, table.id),
  index('accounting_documents_tenant_type_status_idx').on(table.tenantId, table.documentType, table.status),
  index('accounting_documents_tenant_date_idx').on(table.tenantId, table.documentDate),
]);

export const accountingDocumentLines = pgTable('accounting_document_lines', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  documentId: uuid('document_id').notNull(),
  accountId: uuid('account_id').notNull(),
  debitAmount: numeric('debit_amount', { precision: 14, scale: 2 }).default('0').notNull(),
  creditAmount: numeric('credit_amount', { precision: 14, scale: 2 }).default('0').notNull(),
  memo: text(),
}, table => [
  index('accounting_document_lines_tenant_document_idx').on(table.tenantId, table.documentId),
]);

export const accountingDocumentEvents = pgTable('accounting_document_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  documentId: uuid('document_id').notNull(),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  actorId: text('actor_id').notNull(),
  reason: text(),
  metadata: jsonb().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('accounting_document_events_tenant_document_idx').on(table.tenantId, table.documentId, table.createdAt),
]);

export const accountingReconciliationMatches = pgTable('accounting_reconciliation_matches', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  reconciliationId: uuid('reconciliation_id').notNull(),
  journalLineId: uuid('journal_line_id').notNull(),
  matchedAmount: numeric('matched_amount', { precision: 14, scale: 2 }).notNull(),
  matchedById: text('matched_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_reconciliation_matches_line_unique').on(table.tenantId, table.journalLineId),
  index('accounting_reconciliation_matches_reconciliation_idx').on(table.tenantId, table.reconciliationId),
]);

export const accountingClosingRuns = pgTable('accounting_closing_runs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  fiscalPeriodId: uuid('fiscal_period_id').notNull(),
  reason: text().notNull(),
  closedById: text('closed_by_id').notNull(),
  periodEndDate: date('period_end_date').notNull(),
  postedEntryCount: integer('posted_entry_count').default(0).notNull(),
  debitTotal: numeric('debit_total', { precision: 14, scale: 2 }).default('0').notNull(),
  creditTotal: numeric('credit_total', { precision: 14, scale: 2 }).default('0').notNull(),
  netBalance: numeric('net_balance', { precision: 14, scale: 2 }).default('0').notNull(),
  superseded: boolean('superseded').default(false).notNull(),
  supersededById: text('superseded_by_id'),
  supersededAt: timestamp('superseded_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_closing_runs_tenant_id_unique').on(table.tenantId, table.id),
  index('accounting_closing_runs_tenant_period_idx').on(table.tenantId, table.fiscalPeriodId, table.createdAt),
]);

export const accountingClosingBalances = pgTable('accounting_closing_balances', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  closingRunId: uuid('closing_run_id').notNull(),
  accountId: uuid('account_id').notNull(),
  accountCode: varchar('account_code', { length: 50 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  accountType: accountType('account_type').notNull(),
  debitTotal: numeric('debit_total', { precision: 14, scale: 2 }).default('0').notNull(),
  creditTotal: numeric('credit_total', { precision: 14, scale: 2 }).default('0').notNull(),
  netBalance: numeric('net_balance', { precision: 14, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_closing_balances_tenant_id_unique').on(table.tenantId, table.id),
  index('accounting_closing_balances_run_idx').on(table.tenantId, table.closingRunId),
]);

export const accountingPeriodReopenRequests = pgTable('accounting_period_reopen_requests', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  fiscalPeriodId: uuid('fiscal_period_id').notNull(),
  requestedById: text('requested_by_id').notNull(),
  reason: text().notNull(),
  status: varchar({ length: 20 }).default('pending').notNull(),
  decidedById: text('decided_by_id'),
  decidedAt: timestamp('decided_at', { mode: 'string' }),
  decisionNote: text('decision_note'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_period_reopen_requests_tenant_id_unique').on(table.tenantId, table.id),
  index('accounting_period_reopen_requests_tenant_status_idx').on(table.tenantId, table.status, table.createdAt),
]);

export const accountingPeriodEvents = pgTable('accounting_period_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  fiscalPeriodId: uuid('fiscal_period_id').notNull(),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  actorId: text('actor_id').notNull(),
  reason: text(),
  metadata: jsonb().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('accounting_period_events_tenant_period_idx').on(table.tenantId, table.fiscalPeriodId, table.createdAt),
]);

export const accountingStatementImports = pgTable('accounting_statement_imports', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  reconciliationId: uuid('reconciliation_id').notNull(),
  filename: varchar({ length: 255 }).notNull(),
  contentFingerprint: varchar('content_fingerprint', { length: 64 }).notNull(),
  rowsImported: integer('rows_imported').default(0).notNull(),
  importedById: text('imported_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_statement_imports_tenant_id_unique').on(table.tenantId, table.id),
  index('accounting_statement_imports_reconciliation_idx').on(table.tenantId, table.reconciliationId),
]);

export const accountingStatementLines = pgTable('accounting_statement_lines', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  reconciliationId: uuid('reconciliation_id').notNull(),
  lineDate: date('line_date').notNull(),
  description: text().notNull(),
  reference: varchar({ length: 120 }),
  debitAmount: numeric('debit_amount', { precision: 14, scale: 2 }).default('0').notNull(),
  creditAmount: numeric('credit_amount', { precision: 14, scale: 2 }).default('0').notNull(),
  status: varchar({ length: 20 }).default('unmatched').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_statement_lines_tenant_id_unique').on(table.tenantId, table.id),
  index('accounting_statement_lines_reconciliation_idx').on(table.tenantId, table.reconciliationId),
]);

export const accountingStatementMatches = pgTable('accounting_statement_matches', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  reconciliationId: uuid('reconciliation_id').notNull(),
  statementLineId: uuid('statement_line_id').notNull(),
  journalLineId: uuid('journal_line_id').notNull(),
  matchedAmount: numeric('matched_amount', { precision: 14, scale: 2 }).notNull(),
  matchedById: text('matched_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_statement_matches_tenant_id_unique').on(table.tenantId, table.id),
  unique('accounting_statement_matches_pair_unique').on(table.tenantId, table.statementLineId, table.journalLineId),
  index('accounting_statement_matches_statement_idx').on(table.tenantId, table.statementLineId),
  index('accounting_statement_matches_journal_idx').on(table.tenantId, table.journalLineId),
  index('accounting_statement_matches_reconciliation_idx').on(table.tenantId, table.reconciliationId),
]);

export const accountingReconciliationEvents = pgTable('accounting_reconciliation_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  reconciliationId: uuid('reconciliation_id').notNull(),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  actorId: text('actor_id').notNull(),
  reason: text(),
  metadata: jsonb().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('accounting_reconciliation_events_reconciliation_idx').on(table.tenantId, table.reconciliationId, table.createdAt),
]);

export const accountingSourceMappings = pgTable('accounting_source_mappings', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sourceModule: varchar('source_module', { length: 50 }).notNull(),
  sourceKeyType: varchar('source_key_type', { length: 50 }).notNull(),
  sourceKey: varchar('source_key', { length: 100 }),
  accountId: uuid('account_id').notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  unique('accounting_source_mappings_tenant_id_unique').on(table.tenantId, table.id),
  unique('accounting_source_mappings_key_unique').on(table.tenantId, table.sourceModule, table.sourceKeyType, table.sourceKey),
  index('accounting_source_mappings_account_idx').on(table.tenantId, table.accountId),
]);

export const accountingAdapterExceptions = pgTable('accounting_adapter_exceptions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sourceModule: varchar('source_module', { length: 50 }).notNull(),
  sourceDocumentType: varchar('source_document_type', { length: 50 }).notNull(),
  sourceDocumentId: uuid('source_document_id').notNull(),
  version: integer('version').default(1).notNull(),
  reason: varchar({ length: 255 }).notNull(),
  detail: text(),
  payload: jsonb().$type<Record<string, unknown>>(),
  status: varchar({ length: 20 }).default('open').notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at', { mode: 'string' }),
  resolutionNote: text('resolution_note'),
}, table => [
  unique('accounting_adapter_exceptions_tenant_id_unique').on(table.tenantId, table.id),
  unique('accounting_adapter_exceptions_source_unique').on(table.tenantId, table.sourceModule, table.sourceDocumentId, table.version),
  index('accounting_adapter_exceptions_queue_idx').on(table.tenantId, table.status, table.createdAt),
]);
