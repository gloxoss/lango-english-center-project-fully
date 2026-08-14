// Advanced HR & Employee Management add-on schema.
//
// Cross-references follow the feature-schema pattern used by certificates-schema:
// shared types (tenants, user, branches, employeeProfiles) are imported from
// '@/models/Schema' and this file is re-exported by the Schema.ts barrel at the
// bottom. Drizzle FK callbacks are lazy, so the circular import resolves.
//
// Note: employee_profiles.departmentId / designationId are plain uuid columns in
// Schema.ts (no Drizzle FK) because those tables live here; the real FKs are
// added in migration 0073 and enforced at the service layer with tenant checks.
import { date, foreignKey, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { branches, employeeProfiles, tenants, user } from '@/models/Schema';

// ---------------------------------------------------------------------------
// Organizational structure
// ---------------------------------------------------------------------------

export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  name: varchar('name', { length: 120 }).notNull(),
  code: varchar('code', { length: 20 }),
  headEmployeeId: uuid('head_employee_id'),
  description: text(),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'departments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.branchId],
    foreignColumns: [branches.id],
    name: 'departments_branch_id_branches_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.headEmployeeId],
    foreignColumns: [employeeProfiles.id],
    name: 'departments_head_employee_id_employee_profiles_id_fk',
  }).onDelete('set null'),
  unique('departments_tenant_name_unique').on(table.tenantId, table.name),
]);

export const designations = pgTable('designations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  departmentId: uuid('department_id'),
  title: varchar('title', { length: 120 }).notNull(),
  code: varchar('code', { length: 20 }),
  description: text(),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'designations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.departmentId],
    foreignColumns: [departments.id],
    name: 'designations_department_id_departments_id_fk',
  }).onDelete('set null'),
  unique('designations_tenant_title_unique').on(table.tenantId, table.title),
]);

// ---------------------------------------------------------------------------
// HR documents (immutable blob reference)
// ---------------------------------------------------------------------------

export const employeeDocuments = pgTable('employee_documents', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  documentType: varchar('document_type', { length: 50 }).notNull(), // contract | cin | passport | diploma | other
  storageKey: text('storage_key').notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }).notNull(),
  fileSize: integer('file_size').notNull(),
  issuedAt: date('issued_at'),
  expiryDate: date('expiry_date'),
  visibility: varchar('visibility', { length: 20 }).default('private').notNull(),
  uploadedById: text('uploaded_by_id'),
  archivedAt: timestamp('archived_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'employee_documents_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employeeProfiles.id],
    name: 'employee_documents_employee_id_employee_profiles_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.uploadedById],
    foreignColumns: [user.id],
    name: 'employee_documents_uploaded_by_id_user_id_fk',
  }).onDelete('set null'),
]);

// ---------------------------------------------------------------------------
// Immutable employment lifecycle timeline
// ---------------------------------------------------------------------------

export const employeeEmploymentEvents = pgTable('employee_employment_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(), // hired | changed_department | changed_designation | changed_manager | employment_status_change | access_granted | access_revoked | offboarded | reactivated | archived | linked_account
  actorId: text('actor_id').notNull(),
  reason: text('reason'),
  metadata: jsonb('metadata'),
  effectiveAt: timestamp('effective_at', { mode: 'string' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'employee_employment_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employeeProfiles.id],
    name: 'employee_employment_events_employee_id_employee_profiles_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.actorId],
    foreignColumns: [user.id],
    name: 'employee_employment_events_actor_id_user_id_fk',
  }).onDelete('restrict'),
]);

// ---------------------------------------------------------------------------
// Account provisioning / one-time invites
// ---------------------------------------------------------------------------

export const employeeInvitations = pgTable('employee_invitations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
  invitedEmail: varchar('invited_email', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | sent | consumed | expired | revoked
  consumedAt: timestamp('consumed_at', { mode: 'string' }),
  createdById: text('created_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'employee_invitations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employeeProfiles.id],
    name: 'employee_invitations_employee_id_employee_profiles_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'employee_invitations_created_by_id_user_id_fk',
  }).onDelete('set null'),
  unique('employee_invitations_token_hash_unique').on(table.tokenHash),
]);

// ---------------------------------------------------------------------------
// Salary advances & ledger
// ---------------------------------------------------------------------------

export const salaryAdvances = pgTable('salary_advances', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  userId: text('user_id').notNull(),
  requestedAmount: numeric('requested_amount', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  approvedAmount: numeric('approved_amount', { precision: 12, scale: 2, mode: 'number' }),
  repaidAmount: numeric('repaid_amount', { precision: 12, scale: 2, mode: 'number' }).default(0).notNull(),
  monthlyInstallment: numeric('monthly_installment', { precision: 12, scale: 2, mode: 'number' }),
  reason: text('reason'),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | approved | rejected | fully_repaid | cancelled
  requestedAt: date('requested_at').defaultNow().notNull(),
  approvedAt: timestamp('approved_at', { mode: 'string' }),
  approverId: text('approver_id'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'salary_advances_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employeeProfiles.id],
    name: 'salary_advances_employee_id_employee_profiles_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'salary_advances_user_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.approverId],
    foreignColumns: [user.id],
    name: 'salary_advances_approver_id_user_id_fk',
  }).onDelete('set null'),
]);

export const salaryAdvanceTransactions = pgTable('salary_advance_transactions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  advanceId: uuid('advance_id').notNull(),
  type: varchar('type', { length: 20 }).notNull(), // disbursement | payroll_deduction | manual_repayment
  amount: numeric('amount', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  referenceId: text('reference_id'), // payslipId or transaction ref
  transactionDate: date('transaction_date').defaultNow().notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'salary_advance_tx_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.advanceId],
    foreignColumns: [salaryAdvances.id],
    name: 'salary_advance_tx_advance_id_advances_id_fk',
  }).onDelete('cascade'),
]);

// ---------------------------------------------------------------------------
// Employee awards & recognition
// ---------------------------------------------------------------------------

export const employeeAwards = pgTable('employee_awards', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  userId: text('user_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // excellence | innovation | tenure | leadership | teamwork | custom
  monetaryReward: numeric('monetary_reward', { precision: 12, scale: 2, mode: 'number' }).default(0).notNull(),
  giftDescription: text('gift_description'),
  awardDate: date('award_date').notNull(),
  summary: text('summary'),
  presentedBy: varchar('presented_by', { length: 255 }),
  status: varchar('status', { length: 20 }).default('granted').notNull(), // granted | revoked
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'employee_awards_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employeeProfiles.id],
    name: 'employee_awards_employee_id_employee_profiles_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'employee_awards_user_id_user_id_fk',
  }).onDelete('cascade'),
]);

// ---------------------------------------------------------------------------
// Sensitive profile edit approval requests
// ---------------------------------------------------------------------------

export const employeeProfileEditRequests = pgTable('employee_profile_edit_requests', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  userId: text('user_id').notNull(),
  requestType: varchar('request_type', { length: 50 }).notNull(), // bank_rib | tax_cnss | personal_info | emergency_contact
  proposedChanges: jsonb('proposed_changes').notNull(),
  reason: text('reason'),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | approved | rejected | cancelled
  reauthenticatedAt: timestamp('reauthenticated_at', { mode: 'string' }).notNull(),
  reviewedAt: timestamp('reviewed_at', { mode: 'string' }),
  reviewerId: text('reviewer_id'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'employee_edit_req_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employeeProfiles.id],
    name: 'employee_edit_req_employee_id_employee_profiles_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'employee_edit_req_user_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.reviewerId],
    foreignColumns: [user.id],
    name: 'employee_edit_req_reviewer_id_user_id_fk',
  }).onDelete('set null'),
]);
