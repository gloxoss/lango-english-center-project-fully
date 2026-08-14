// Library Management add-on + Librarian Portal schema (V1).
//
// Follows the proven feature-schema pattern (hostel-schema.ts): shared types
// (tenants, user, branches) are imported from '@/models/Schema' and this file
// is re-exported by the Schema.ts barrel at the bottom. Drizzle FK callbacks
// are lazy, so the circular import resolves.
//
// Partial/EXCLUDE invariants that Drizzle cannot express (one active loan per
// copy, one active hold per copy+member, partial-unique ISBN, fine-dedupe)
// are added in migration 0079 only. Never run drizzle-kit generate.

import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { branches, tenants, user } from '@/models/Schema';

// ---------------------------------------------------------------------------
// Enums (fixed business categories that drive real branching logic)
// ---------------------------------------------------------------------------

export const libraryCopyState = pgEnum('library_copy_state', [
  'available',
  'on_hold_shelf',
  'checked_out',
  'in_transit',
  'repair',
  'lost',
  'missing',
  'withdrawn',
]);

export const libraryCopyCondition = pgEnum('library_copy_condition', [
  'new',
  'good',
  'fair',
  'poor',
  'damaged',
]);

export const libraryMemberState = pgEnum('library_member_state', [
  'active',
  'blocked',
  'inactive',
]);

export const libraryLoanEventType = pgEnum('library_loan_event_type', [
  'issued',
  'renewed',
  'returned',
  'lost',
  'damaged',
  'recovered',
  'withdrawn',
]);

export const libraryHoldState = pgEnum('library_hold_state', [
  'waiting',
  'fulfilled',
  'cancelled',
  'expired',
]);

export const libraryTransferState = pgEnum('library_transfer_state', [
  'requested',
  'dispatched',
  'received',
  'discrepancy',
  'cancelled',
]);

export const libraryStocktakeState = pgEnum('library_stocktake_state', [
  'open',
  'closed',
]);

export const libraryChargeState = pgEnum('library_charge_state', [
  'open',
  'waived',
  'paid',
]);

export const libraryChargeAdjustmentType = pgEnum('library_charge_adjustment_type', [
  'waive',
  'reduce',
  'reapply',
]);

export const libraryNotificationType = pgEnum('library_notification_type', [
  'due_soon',
  'overdue',
  'hold_ready',
  'hold_expired',
  'member_blocked',
]);

// ---------------------------------------------------------------------------
// Catalog: bibliographic work -> contributors/publishers/categories/subjects
// ---------------------------------------------------------------------------

export const libraryBibliographicRecords = pgTable('library_bibliographic_records', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  subtitle: varchar('subtitle', { length: 500 }),
  language: varchar('language', { length: 50 }),
  publicationYear: integer('publication_year'),
  summary: text('summary'),
  deletedAt: timestamp('deleted_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_records_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  index('library_records_tenant_title_idx').on(table.tenantId, table.title),
]);

export const libraryContributors = pgTable('library_contributors', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  // role of the person overall (author/editor/illustrator/translator) - kept
  // at contributor level so one person can hold several record-link roles.
  primaryRole: varchar('primary_role', { length: 50 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_contributors_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('library_contributors_tenant_name_unique').on(table.tenantId, table.name),
]);

export const libraryRecordContributors = pgTable('library_record_contributors', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  recordId: uuid('record_id').notNull(),
  contributorId: uuid('contributor_id').notNull(),
  role: varchar('role', { length: 50 }).notNull(), // author/editor/illustrator/translator
  sortOrder: integer('sort_order').default(0).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_record_contributors_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.recordId],
    foreignColumns: [libraryBibliographicRecords.id],
    name: 'library_record_contributors_record_id_records_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.contributorId],
    foreignColumns: [libraryContributors.id],
    name: 'library_record_contributors_contributor_id_contributors_id_fk',
  }).onDelete('cascade'),
  unique('library_record_contributors_record_contributor_role_unique').on(table.recordId, table.contributorId, table.role),
]);

export const libraryPublishers = pgTable('library_publishers', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_publishers_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('library_publishers_tenant_name_unique').on(table.tenantId, table.name),
]);

export const libraryCategories = pgTable('library_categories', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  parentId: uuid('parent_id'),
  name: varchar('name', { length: 255 }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_categories_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id],
    name: 'library_categories_parent_id_categories_id_fk',
  }).onDelete('set null'),
  unique('library_categories_tenant_parent_name_unique').on(table.tenantId, table.parentId, table.name),
]);

export const librarySubjects = pgTable('library_subjects', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_subjects_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('library_subjects_tenant_name_unique').on(table.tenantId, table.name),
]);

export const libraryRecordSubjects = pgTable('library_record_subjects', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  recordId: uuid('record_id').notNull(),
  subjectId: uuid('subject_id').notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_record_subjects_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.recordId],
    foreignColumns: [libraryBibliographicRecords.id],
    name: 'library_record_subjects_record_id_records_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.subjectId],
    foreignColumns: [librarySubjects.id],
    name: 'library_record_subjects_subject_id_subjects_id_fk',
  }).onDelete('cascade'),
  unique('library_record_subjects_record_subject_unique').on(table.recordId, table.subjectId),
]);

// ---------------------------------------------------------------------------
// Editions + copies (the physical inventory)
// ---------------------------------------------------------------------------

export const libraryEditions = pgTable('library_editions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  recordId: uuid('record_id').notNull(),
  publisherId: uuid('publisher_id'),
  isbn13: varchar('isbn13', { length: 13 }),
  isbn10: varchar('isbn10', { length: 10 }),
  publicationYear: integer('publication_year'),
  pages: integer('pages'),
  format: varchar('format', { length: 50 }), // paperback/hardcover/ebook
  coverUrl: text('cover_url'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_editions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.recordId],
    foreignColumns: [libraryBibliographicRecords.id],
    name: 'library_editions_record_id_records_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.publisherId],
    foreignColumns: [libraryPublishers.id],
    name: 'library_editions_publisher_id_publishers_id_fk',
  }).onDelete('set null'),
  index('library_editions_tenant_record_idx').on(table.tenantId, table.recordId),
]);

export const libraryCopies = pgTable('library_copies', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  editionId: uuid('edition_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  accessionNumber: varchar('accession_number', { length: 50 }).notNull(),
  barcode: varchar('barcode', { length: 50 }),
  shelfLocation: varchar('shelf_location', { length: 100 }),
  condition: libraryCopyCondition('condition').default('good').notNull(),
  state: libraryCopyState('state').default('available').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }),
  acquiredAt: date('acquired_at', { mode: 'string' }),
  withdrawnAt: timestamp('withdrawn_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_copies_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.editionId],
    foreignColumns: [libraryEditions.id],
    name: 'library_copies_edition_id_editions_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.branchId],
    foreignColumns: [branches.id],
    name: 'library_copies_branch_id_branches_id_fk',
  }).onDelete('restrict'),
  unique('library_copies_tenant_accession_unique').on(table.tenantId, table.accessionNumber),
  index('library_copies_tenant_branch_state_idx').on(table.tenantId, table.branchId, table.state),
]);

// ---------------------------------------------------------------------------
// Members + loan policies
// ---------------------------------------------------------------------------

export const libraryMembers = pgTable('library_members', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  memberNumber: varchar('member_number', { length: 50 }).notNull(),
  branchId: uuid('branch_id').notNull(),
  state: libraryMemberState('state').default('active').notNull(),
  blockReason: text('block_reason'),
  blockUntil: date('block_until', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_members_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'library_members_user_id_users_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.branchId],
    foreignColumns: [branches.id],
    name: 'library_members_branch_id_branches_id_fk',
  }).onDelete('restrict'),
  unique('library_members_tenant_member_number_unique').on(table.tenantId, table.memberNumber),
  unique('library_members_tenant_user_unique').on(table.tenantId, table.userId),
]);

export const libraryLoanPolicies = pgTable('library_loan_policies', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  // patronCategory matches the app role for now (student/teacher/receptionist/
  // parent), extensible to custom categories later.
  patronCategory: varchar('patron_category', { length: 50 }).notNull(),
  branchId: uuid('branch_id'),
  maxLoans: integer('max_loans').default(3).notNull(),
  loanDurationDays: integer('loan_duration_days').default(14).notNull(),
  renewalLimit: integer('renewal_limit').default(1).notNull(),
  renewalDurationDays: integer('renewal_duration_days').default(14).notNull(),
  finePerDay: numeric('fine_per_day', { precision: 10, scale: 2 }).default('0').notNull(),
  gracePeriodDays: integer('grace_period_days').default(0).notNull(),
  maxHolds: integer('max_holds').default(3).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_loan_policies_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.branchId],
    foreignColumns: [branches.id],
    name: 'library_loan_policies_branch_id_branches_id_fk',
  }).onDelete('cascade'),
  index('library_loan_policies_tenant_category_idx').on(table.tenantId, table.patronCategory),
  // One policy per (tenant, category, branch) and one generic (branch NULL) per
  // (tenant, category) so resolveMemberPolicy's precedence is never ambiguous.
  uniqueIndex('library_loan_policies_tenant_category_branch_unique')
    .on(table.tenantId, table.patronCategory, table.branchId)
    .where(sql`${table.branchId} IS NOT NULL`),
  uniqueIndex('library_loan_policies_tenant_category_generic_unique')
    .on(table.tenantId, table.patronCategory)
    .where(sql`${table.branchId} IS NULL`),
]);

// Branch closure calendar: a date the library (branch-scoped or tenant-wide,
// branchId NULL) is closed. Due dates skip closure days.
export const libraryClosureDays = pgTable('library_closure_calendar', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  closedOn: date('closed_on', { mode: 'string' }).notNull(),
  reason: varchar('reason', { length: 255 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_closure_calendar_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.branchId],
    foreignColumns: [branches.id],
    name: 'library_closure_calendar_branch_id_branches_id_fk',
  }).onDelete('cascade'),
  uniqueIndex('library_closure_calendar_tenant_branch_date_unique')
    .on(table.tenantId, table.branchId, table.closedOn)
    .where(sql`${table.branchId} IS NOT NULL`),
  uniqueIndex('library_closure_calendar_tenant_date_unique')
    .on(table.tenantId, table.closedOn)
    .where(sql`${table.branchId} IS NULL`),
  index('library_closure_calendar_tenant_date_idx').on(table.tenantId, table.closedOn),
]);

// ---------------------------------------------------------------------------
// Circulation: loans + immutable event history
// ---------------------------------------------------------------------------

export const libraryLoans = pgTable('library_loans', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  copyId: uuid('copy_id').notNull(),
  memberId: uuid('member_id').notNull(),
  issuedById: text('issued_by_id').notNull(),
  issuedAt: timestamp('issued_at', { mode: 'string' }).defaultNow().notNull(),
  dueDate: date('due_date', { mode: 'string' }).notNull(),
  returnedAt: timestamp('returned_at', { mode: 'string' }),
  // returnState: good/damaged/lost - set once at return/finalize.
  returnState: varchar('return_state', { length: 20 }),
  renewedCount: integer('renewed_count').default(0).notNull(),
  // Snapshot of the policy at issue time - later policy edits never silently
  // change existing loans.
  policySnapshot: jsonb('policy_snapshot').notNull(),
  // Desk idempotency: a stable key so a repeated checkout scan returns the
  // existing loan instead of double-loaning. Partial-unique index in 0094.
  idempotencyKey: varchar('idempotency_key', { length: 120 }),
  note: text('note'),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_loans_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.copyId],
    foreignColumns: [libraryCopies.id],
    name: 'library_loans_copy_id_copies_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.memberId],
    foreignColumns: [libraryMembers.id],
    name: 'library_loans_member_id_members_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.issuedById],
    foreignColumns: [user.id],
    name: 'library_loans_issued_by_id_users_id_fk',
  }).onDelete('restrict'),
  index('library_loans_tenant_member_idx').on(table.tenantId, table.memberId),
  index('library_loans_tenant_due_date_idx').on(table.tenantId, table.dueDate),
  uniqueIndex('library_loans_tenant_idempotency_key_idx').on(table.tenantId, table.idempotencyKey),
]);

export const libraryLoanEvents = pgTable('library_loan_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  loanId: uuid('loan_id').notNull(),
  eventType: libraryLoanEventType('event_type').notNull(),
  actorId: text('actor_id').notNull(),
  at: timestamp('at', { mode: 'string' }).defaultNow().notNull(),
  note: text('note'),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_loan_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.loanId],
    foreignColumns: [libraryLoans.id],
    name: 'library_loan_events_loan_id_loans_id_fk',
  }).onDelete('cascade'),
  index('library_loan_events_tenant_loan_idx').on(table.tenantId, table.loanId),
]);

// ---------------------------------------------------------------------------
// Holds/reservations + immutable event history
// ---------------------------------------------------------------------------

export const libraryHolds = pgTable('library_holds', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  copyId: uuid('copy_id').notNull(),
  memberId: uuid('member_id').notNull(),
  placedById: text('placed_by_id').notNull(),
  placedAt: timestamp('placed_at', { mode: 'string' }).defaultNow().notNull(),
  state: libraryHoldState('state').default('waiting').notNull(),
  expiresAt: date('expires_at', { mode: 'string' }),
  fulfilledLoanId: uuid('fulfilled_loan_id'),
  cancelledAt: timestamp('cancelled_at', { mode: 'string' }),
  cancelReason: text('cancel_reason'),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_holds_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.copyId],
    foreignColumns: [libraryCopies.id],
    name: 'library_holds_copy_id_copies_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.memberId],
    foreignColumns: [libraryMembers.id],
    name: 'library_holds_member_id_members_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.placedById],
    foreignColumns: [user.id],
    name: 'library_holds_placed_by_id_users_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.fulfilledLoanId],
    foreignColumns: [libraryLoans.id],
    name: 'library_holds_fulfilled_loan_id_loans_id_fk',
  }).onDelete('set null'),
  index('library_holds_tenant_copy_state_idx').on(table.tenantId, table.copyId, table.state),
]);

export const libraryHoldEvents = pgTable('library_hold_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  holdId: uuid('hold_id').notNull(),
  eventType: varchar('event_type', { length: 30 }).notNull(), // placed/fulfilled/cancelled/expired/notified
  actorId: text('actor_id').notNull(),
  at: timestamp('at', { mode: 'string' }).defaultNow().notNull(),
  note: text('note'),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_hold_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.holdId],
    foreignColumns: [libraryHolds.id],
    name: 'library_hold_events_hold_id_holds_id_fk',
  }).onDelete('cascade'),
  index('library_hold_events_tenant_hold_idx').on(table.tenantId, table.holdId),
]);

// ---------------------------------------------------------------------------
// Transfers between branches + immutable event history
// ---------------------------------------------------------------------------

export const libraryTransfers = pgTable('library_transfers', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  copyId: uuid('copy_id').notNull(),
  fromBranchId: uuid('from_branch_id').notNull(),
  toBranchId: uuid('to_branch_id').notNull(),
  state: libraryTransferState('state').default('requested').notNull(),
  requestedById: text('requested_by_id').notNull(),
  dispatchedAt: timestamp('dispatched_at', { mode: 'string' }),
  dispatchedById: text('dispatched_by_id'),
  receivedAt: timestamp('received_at', { mode: 'string' }),
  receivedById: text('received_by_id'),
  note: text('note'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_transfers_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.copyId],
    foreignColumns: [libraryCopies.id],
    name: 'library_transfers_copy_id_copies_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.fromBranchId],
    foreignColumns: [branches.id],
    name: 'library_transfers_from_branch_id_branches_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.toBranchId],
    foreignColumns: [branches.id],
    name: 'library_transfers_to_branch_id_branches_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.requestedById],
    foreignColumns: [user.id],
    name: 'library_transfers_requested_by_id_users_id_fk',
  }).onDelete('restrict'),
  index('library_transfers_tenant_state_idx').on(table.tenantId, table.state),
]);

export const libraryTransferEvents = pgTable('library_transfer_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  transferId: uuid('transfer_id').notNull(),
  eventType: varchar('event_type', { length: 30 }).notNull(), // requested/dispatched/received/discrepancy/cancelled
  actorId: text('actor_id').notNull(),
  at: timestamp('at', { mode: 'string' }).defaultNow().notNull(),
  note: text('note'),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_transfer_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.transferId],
    foreignColumns: [libraryTransfers.id],
    name: 'library_transfer_events_transfer_id_transfers_id_fk',
  }).onDelete('cascade'),
  index('library_transfer_events_tenant_transfer_idx').on(table.tenantId, table.transferId),
]);

// ---------------------------------------------------------------------------
// Stocktake: validate -> observe -> adjust; adjustments never rewrite history
// ---------------------------------------------------------------------------

export const libraryStocktakes = pgTable('library_stocktakes', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  state: libraryStocktakeState('state').default('open').notNull(),
  startedById: text('started_by_id').notNull(),
  startedAt: timestamp('started_at', { mode: 'string' }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { mode: 'string' }),
  closedById: text('closed_by_id'),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_stocktakes_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.branchId],
    foreignColumns: [branches.id],
    name: 'library_stocktakes_branch_id_branches_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.startedById],
    foreignColumns: [user.id],
    name: 'library_stocktakes_started_by_id_users_id_fk',
  }).onDelete('restrict'),
  index('library_stocktakes_tenant_branch_state_idx').on(table.tenantId, table.branchId, table.state),
]);

export const libraryStocktakeObservations = pgTable('library_stocktake_observations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  stocktakeId: uuid('stocktake_id').notNull(),
  copyId: uuid('copy_id').notNull(),
  countedById: text('counted_by_id').notNull(),
  countedAt: timestamp('counted_at', { mode: 'string' }).defaultNow().notNull(),
  found: boolean('found'),
  note: text('note'),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_stocktake_observations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.stocktakeId],
    foreignColumns: [libraryStocktakes.id],
    name: 'library_stocktake_observations_stocktake_id_stocktakes_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.copyId],
    foreignColumns: [libraryCopies.id],
    name: 'library_stocktake_observations_copy_id_copies_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.countedById],
    foreignColumns: [user.id],
    name: 'library_stocktake_observations_counted_by_id_users_id_fk',
  }).onDelete('restrict'),
  index('library_stocktake_observations_tenant_stocktake_idx').on(table.tenantId, table.stocktakeId),
  unique('library_stocktake_observations_stocktake_copy_unique').on(table.stocktakeId, table.copyId),
]);

export const libraryStocktakeAdjustments = pgTable('library_stocktake_adjustments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  stocktakeId: uuid('stocktake_id').notNull(),
  observationId: uuid('observation_id').notNull(),
  copyId: uuid('copy_id').notNull(),
  fromState: libraryCopyState('from_state').notNull(),
  toState: libraryCopyState('to_state').notNull(),
  resolvedById: text('resolved_by_id').notNull(),
  reason: text('reason').notNull(),
  at: timestamp('at', { mode: 'string' }).defaultNow().notNull(),
  // Set when an approver applies the adjustment to the copy state. Partial
  // unique index (tenant, stocktake, copy) WHERE applied_at IS NULL prevents a
  // copy being adjusted twice within the same stocktake.
  appliedAt: timestamp('applied_at', { mode: 'string' }),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_stocktake_adjustments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.stocktakeId],
    foreignColumns: [libraryStocktakes.id],
    name: 'library_stocktake_adjustments_stocktake_id_stocktakes_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.observationId],
    foreignColumns: [libraryStocktakeObservations.id],
    name: 'library_stocktake_adjustments_observation_id_observations_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.copyId],
    foreignColumns: [libraryCopies.id],
    name: 'library_stocktake_adjustments_copy_id_copies_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.resolvedById],
    foreignColumns: [user.id],
    name: 'library_stocktake_adjustments_resolved_by_id_users_id_fk',
  }).onDelete('restrict'),
  uniqueIndex('library_stocktake_adjustments_tenant_stocktake_copy_unapplied_idx')
    .on(table.tenantId, table.stocktakeId, table.copyId)
    .where(sql`${table.appliedAt} IS NULL`),
]);

// ---------------------------------------------------------------------------
// Charges (operational subledger) + adjustments
// ---------------------------------------------------------------------------

export const libraryCharges = pgTable('library_charges', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  memberId: uuid('member_id').notNull(),
  loanId: uuid('loan_id'),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  reason: varchar('reason', { length: 50 }).notNull(), // overdue_fine/lost_copy/damage
  state: libraryChargeState('state').default('open').notNull(),
  waivedById: text('waived_by_id'),
  waivedAt: timestamp('waived_at', { mode: 'string' }),
  waiverReason: text('waiver_reason'),
  // Idempotency: a stable key so retries never double-post a fine.
  dedupeKey: varchar('dedupe_key', { length: 100 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_charges_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.memberId],
    foreignColumns: [libraryMembers.id],
    name: 'library_charges_member_id_members_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.loanId],
    foreignColumns: [libraryLoans.id],
    name: 'library_charges_loan_id_loans_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.waivedById],
    foreignColumns: [user.id],
    name: 'library_charges_waived_by_id_users_id_fk',
  }).onDelete('restrict'),
  index('library_charges_tenant_member_idx').on(table.tenantId, table.memberId),
]);

export const libraryChargeAdjustments = pgTable('library_charge_adjustments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  chargeId: uuid('charge_id').notNull(),
  adjustmentType: libraryChargeAdjustmentType('adjustment_type').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  actorId: text('actor_id').notNull(),
  reason: text('reason').notNull(),
  at: timestamp('at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_charge_adjustments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.chargeId],
    foreignColumns: [libraryCharges.id],
    name: 'library_charge_adjustments_charge_id_charges_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.actorId],
    foreignColumns: [user.id],
    name: 'library_charge_adjustments_actor_id_users_id_fk',
  }).onDelete('restrict'),
]);

// ---------------------------------------------------------------------------
// Notification intents (in-app V1; publishable to Communication later)
// ---------------------------------------------------------------------------

export const libraryNotifications = pgTable('library_notifications', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  memberId: uuid('member_id').notNull(),
  type: libraryNotificationType('type').notNull(),
  channel: varchar('channel', { length: 20 }).default('in_app').notNull(),
  state: varchar('state', { length: 20 }).default('queued').notNull(), // queued/delivered/failed
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at', { mode: 'string' }),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'library_notifications_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.memberId],
    foreignColumns: [libraryMembers.id],
    name: 'library_notifications_member_id_members_id_fk',
  }).onDelete('cascade'),
  index('library_notifications_tenant_member_idx').on(table.tenantId, table.memberId),
]);
