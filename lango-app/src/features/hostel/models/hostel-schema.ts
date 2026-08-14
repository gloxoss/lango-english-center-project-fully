// Hostel Management add-on schema (v1 = phases 0-3).
//
// Cross-references follow the proven feature-schema pattern (hr-schema.ts):
// shared types (tenants, user, branches, employeeProfiles, sessionYears,
// feeStructures, invoices, invoiceItems) are imported from '@/models/Schema'
// and this file is re-exported by the Schema.ts barrel at the bottom. Drizzle
// FK callbacks are lazy, so the circular import resolves.
//
// The bed/student non-overlap EXCLUDE constraints cannot be expressed in Drizzle
// - they are added in migration 0076 (hand-written SQL) only. Never run
// drizzle-kit generate.
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
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
  time,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  branches,
  employeeProfiles,
  feeStructures,
  invoiceItems,
  invoices,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

// ---------------------------------------------------------------------------
// Enums (fixed business categories that drive real branching logic)
// ---------------------------------------------------------------------------

export const hostelAllocationState = pgEnum('hostel_allocation_state', [
  'reserved',
  'checked_in',
  'checked_out',
  'cancelled',
]);

export const hostelRollCallEntryStatus = pgEnum('hostel_roll_call_entry_status', [
  'present',
  'approved_leave',
  'late',
  'missing',
  'sick',
  'excused',
]);

// ---------------------------------------------------------------------------
// Configurable tenant policy (Phase 0 ADR -> table)
// ---------------------------------------------------------------------------

export const hostelPolicies = pgTable('hostel_policies', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  policies: jsonb('policies').notNull(), // eligibility, consent thresholds, escalation tiers, retention, safeguarding access, charge policy, emergency-departure rule
  version: integer('version').default(1).notNull(),
  updatedById: text('updated_by_id'),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_policies_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.updatedById],
    foreignColumns: [user.id],
    name: 'hostel_policies_updated_by_id_user_id_fk',
  }).onDelete('set null'),
  unique('hostel_policies_tenant_unique').on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// Residences / buildings
// ---------------------------------------------------------------------------

export const hostels = pgTable('hostels', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text(),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  genderPolicy: varchar('gender_policy', { length: 20 }).default('mixed').notNull(), // mixed | male_only | female_only
  ageMin: integer('age_min'),
  ageMax: integer('age_max'),
  policySnapshot: jsonb('policy_snapshot'), // curfew, visitor hours, charge policy, escalation snapshot
  wardenEmployeeId: uuid('warden_employee_id'),
  emergencyContactName: varchar('emergency_contact_name', { length: 255 }),
  emergencyContactPhone: varchar('emergency_contact_phone', { length: 50 }),
  capacity: integer('capacity').default(0).notNull(), // cached projection, recomputed by the board read model - never a manual counter
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | inactive | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostels_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.branchId],
    foreignColumns: [branches.id],
    name: 'hostels_branch_id_branches_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.wardenEmployeeId],
    foreignColumns: [employeeProfiles.id],
    name: 'hostels_warden_employee_id_employee_profiles_id_fk',
  }).onDelete('set null'),
  unique('hostels_tenant_code_unique').on(table.tenantId, table.code),
  index('hostels_tenant_branch_idx').on(table.tenantId, table.branchId),
]);

// ---------------------------------------------------------------------------
// Zones: building / floor / wing hierarchy
// ---------------------------------------------------------------------------

export const hostelZones = pgTable('hostel_zones', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  hostelId: uuid('hostel_id').notNull(),
  parentZoneId: uuid('parent_zone_id'),
  zoneType: varchar('zone_type', { length: 20 }).default('floor').notNull(), // building | floor | wing | zone
  code: varchar('code', { length: 50 }),
  name: varchar('name', { length: 255 }).notNull(),
  curfewTime: time('curfew_time'),
  rollCallTime: time('roll_call_time'),
  visitorHours: jsonb('visitor_hours'),
  emergencyAssemblyPoint: text('emergency_assembly_point'),
  chargePolicyOverride: jsonb('charge_policy_override'),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_zones_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.hostelId],
    foreignColumns: [hostels.id],
    name: 'hostel_zones_hostel_id_hostels_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.parentZoneId],
    foreignColumns: [table.id],
    name: 'hostel_zones_parent_zone_id_hostel_zones_id_fk',
  }).onDelete('set null'),
  unique('hostel_zones_tenant_hostel_code_unique').on(table.tenantId, table.hostelId, table.code),
  index('hostel_zones_hostel_idx').on(table.hostelId),
]);

// ---------------------------------------------------------------------------
// Room / bed categories
// ---------------------------------------------------------------------------

export const hostelRoomCategories = pgTable('hostel_room_categories', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  code: varchar('code', { length: 30 }).notNull(),
  defaultCapacity: integer('default_capacity'),
  amenities: jsonb('amenities'),
  eligibleGenderPolicy: varchar('eligible_gender_policy', { length: 20 }).default('mixed').notNull(), // mixed | male_only | female_only
  eligibleCohortIds: jsonb('eligible_cohort_ids'), // classSectionId list
  baseCharge: numeric('base_charge', { precision: 12, scale: 2 }).default('0').notNull(),
  depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  priority: integer('priority').default(0).notNull(),
  isAccessible: boolean('is_accessible').default(false).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_room_categories_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('hostel_room_categories_tenant_code_unique').on(table.tenantId, table.code),
]);

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const hostelRooms = pgTable('hostel_rooms', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  hostelId: uuid('hostel_id').notNull(),
  zoneId: uuid('zone_id'),
  categoryId: uuid('category_id'),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }),
  isAccessible: boolean('is_accessible').default(false).notNull(),
  facilities: jsonb('facilities'),
  responsibleEmployeeId: uuid('responsible_employee_id'),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | inactive | out_of_service | archived
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_rooms_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.hostelId],
    foreignColumns: [hostels.id],
    name: 'hostel_rooms_hostel_id_hostels_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.zoneId],
    foreignColumns: [hostelZones.id],
    name: 'hostel_rooms_zone_id_hostel_zones_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.categoryId],
    foreignColumns: [hostelRoomCategories.id],
    name: 'hostel_rooms_category_id_hostel_room_categories_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.responsibleEmployeeId],
    foreignColumns: [employeeProfiles.id],
    name: 'hostel_rooms_responsible_employee_id_employee_profiles_id_fk',
  }).onDelete('set null'),
  unique('hostel_rooms_tenant_hostel_code_unique').on(table.tenantId, table.hostelId, table.code),
  index('hostel_rooms_hostel_zone_category_idx').on(table.hostelId, table.zoneId, table.categoryId),
]);

// ---------------------------------------------------------------------------
// Beds (explicit numbered beds; room capacity = count of usable beds)
// ---------------------------------------------------------------------------

export const hostelBeds = pgTable('hostel_beds', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  roomId: uuid('room_id').notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  isAccessible: boolean('is_accessible').default(false).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active | out_of_service | archived
  notes: text(), // facility/maintenance only - never another resident's data
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_beds_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.roomId],
    foreignColumns: [hostelRooms.id],
    name: 'hostel_beds_room_id_hostel_rooms_id_fk',
  }).onDelete('cascade'),
  unique('hostel_beds_tenant_room_code_unique').on(table.tenantId, table.roomId, table.code),
  index('hostel_beds_room_idx').on(table.roomId),
]);

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export const hostelApplications = pgTable('hostel_applications', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  sessionYearId: uuid('session_year_id'),
  requestedStartDate: date('requested_start_date').notNull(),
  requestedEndDate: date('requested_end_date').notNull(), // EXCLUSIVE - first day no longer needed
  preferredCategoryIds: jsonb('preferred_category_ids'),
  preferredRoomId: uuid('preferred_room_id'),
  priorityReason: text('priority_reason'),
  guardianConsentStatus: varchar('guardian_consent_status', { length: 20 }).default('not_required').notNull(), // not_required | required | approved | denied
  decision: varchar('decision', { length: 20 }).default('pending').notNull(), // pending | approved | denied | waitlisted | withdrawn
  decisionReason: text('decision_reason'),
  decidedById: text('decided_by_id'),
  decidedAt: timestamp('decided_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_applications_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'hostel_applications_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sessionYearId],
    foreignColumns: [sessionYears.id],
    name: 'hostel_applications_session_year_id_session_years_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.preferredRoomId],
    foreignColumns: [hostelRooms.id],
    name: 'hostel_applications_preferred_room_id_hostel_rooms_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.decidedById],
    foreignColumns: [user.id],
    name: 'hostel_applications_decided_by_id_user_id_fk',
  }).onDelete('set null'),
  check('hostel_applications_date_range_check', sql`${table.requestedEndDate} > ${table.requestedStartDate}`),
  index('hostel_applications_tenant_student_session_idx').on(table.tenantId, table.studentId, table.sessionYearId),
  index('hostel_applications_tenant_decision_idx').on(table.tenantId, table.decision),
]);

// ---------------------------------------------------------------------------
// Allocations (effective-dated source of truth; occupancy is derived from here)
// ---------------------------------------------------------------------------

export const hostelAllocations = pgTable('hostel_allocations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  applicationId: uuid('application_id'),
  studentId: text('student_id').notNull(),
  bedId: uuid('bed_id').notNull(),
  effectiveStartDate: date('effective_start_date').notNull(),
  effectiveEndDate: date('effective_end_date').notNull(), // EXCLUSIVE - half-open [start, end)
  state: hostelAllocationState('state').default('reserved').notNull(),
  chargeSnapshot: jsonb('charge_snapshot'), // baseCharge/deposit captured at reservation
  sourceAllocationId: uuid('source_allocation_id'),
  checkedInAt: timestamp('checked_in_at', { mode: 'string' }),
  checkedOutAt: timestamp('checked_out_at', { mode: 'string' }),
  notes: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_allocations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.applicationId],
    foreignColumns: [hostelApplications.id],
    name: 'hostel_allocations_application_id_hostel_applications_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'hostel_allocations_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.bedId],
    foreignColumns: [hostelBeds.id],
    name: 'hostel_allocations_bed_id_hostel_beds_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sourceAllocationId],
    foreignColumns: [table.id],
    name: 'hostel_allocations_source_allocation_id_hostel_allocations_id_fk',
  }).onDelete('set null'),
  check('hostel_allocations_date_range_check', sql`${table.effectiveEndDate} > ${table.effectiveStartDate}`),
  index('hostel_allocations_tenant_bed_idx').on(table.tenantId, table.bedId),
  index('hostel_allocations_tenant_student_idx').on(table.tenantId, table.studentId),
  index('hostel_allocations_tenant_state_idx').on(table.tenantId, table.state),
  // NOTE: the two EXCLUDE constraints (bed_no_overlap, student_no_overlap) are
  // added in migration 0076 - Drizzle cannot express EXCLUDE USING gist.
]);

// ---------------------------------------------------------------------------
// Immutable allocation event history (append-only - no UPDATE path in services)
// ---------------------------------------------------------------------------

export const hostelAllocationEvents = pgTable('hostel_allocation_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  allocationId: uuid('allocation_id').notNull(),
  eventType: varchar('event_type', { length: 30 }).notNull(), // reserved | confirmed | checked_in | checked_out | transferred_out | transferred_in | cancelled | corrected | extended | shortened
  actorId: text('actor_id').notNull(),
  reason: text('reason'), // restricted field - shown only with hostel.safeguarding.read
  metadata: jsonb('metadata'), // before/after snapshots
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_allocation_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.allocationId],
    foreignColumns: [hostelAllocations.id],
    name: 'hostel_allocation_events_allocation_id_hostel_allocations_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.actorId],
    foreignColumns: [user.id],
    name: 'hostel_allocation_events_actor_id_user_id_fk',
  }).onDelete('restrict'),
  index('hostel_allocation_events_tenant_allocation_idx').on(table.tenantId, table.allocationId),
]);

// ---------------------------------------------------------------------------
// Roll call (nightly register - one per hostel per day; separate from academic attendance)
// ---------------------------------------------------------------------------

export const hostelRollCalls = pgTable('hostel_roll_calls', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  hostelId: uuid('hostel_id').notNull(),
  callDate: date('call_date').notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(), // open | closed | cancelled
  openedById: text('opened_by_id').notNull(),
  closedById: text('closed_by_id'),
  closedAt: timestamp('closed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_roll_calls_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.hostelId],
    foreignColumns: [hostels.id],
    name: 'hostel_roll_calls_hostel_id_hostels_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.openedById],
    foreignColumns: [user.id],
    name: 'hostel_roll_calls_opened_by_id_user_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.closedById],
    foreignColumns: [user.id],
    name: 'hostel_roll_calls_closed_by_id_user_id_fk',
  }).onDelete('set null'),
  unique('hostel_roll_calls_tenant_hostel_date_unique').on(table.tenantId, table.hostelId, table.callDate),
]);

export const hostelRollCallEntries = pgTable('hostel_roll_call_entries', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  rollCallId: uuid('roll_call_id').notNull(),
  allocationId: uuid('allocation_id').notNull(),
  status: hostelRollCallEntryStatus('status').notNull(),
  notedById: text('noted_by_id').notNull(),
  note: text(),
  notedAt: timestamp('noted_at', { mode: 'string' }).defaultNow().notNull(),
  lastUpdatedAt: timestamp('last_updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_roll_call_entries_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.rollCallId],
    foreignColumns: [hostelRollCalls.id],
    name: 'hostel_roll_call_entries_roll_call_id_hostel_roll_calls_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.allocationId],
    foreignColumns: [hostelAllocations.id],
    name: 'hostel_roll_call_entries_allocation_id_hostel_allocations_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.notedById],
    foreignColumns: [user.id],
    name: 'hostel_roll_call_entries_noted_by_id_user_id_fk',
  }).onDelete('restrict'),
  unique('hostel_roll_call_entries_tenant_rollcall_allocation_unique').on(table.tenantId, table.rollCallId, table.allocationId),
  index('hostel_roll_call_entries_allocation_idx').on(table.allocationId),
]);

// ---------------------------------------------------------------------------
// Leave / return passes
// ---------------------------------------------------------------------------

export const hostelLeavePasses = pgTable('hostel_leave_passes', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  allocationId: uuid('allocation_id').notNull(),
  studentId: text('student_id').notNull(),
  destination: text(),
  reason: text(),
  startDateTime: timestamp('start_date_time', { mode: 'string' }).notNull(),
  expectedReturnAt: timestamp('expected_return_at', { mode: 'string' }).notNull(),
  actualReturnAt: timestamp('actual_return_at', { mode: 'string' }),
  guardianApprovalRequired: boolean('guardian_approval_required').default(false).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | approved | denied | active | returned | expired | cancelled
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_leave_passes_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.allocationId],
    foreignColumns: [hostelAllocations.id],
    name: 'hostel_leave_passes_allocation_id_hostel_allocations_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'hostel_leave_passes_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'hostel_leave_passes_created_by_id_user_id_fk',
  }).onDelete('restrict'),
  index('hostel_leave_passes_tenant_status_idx').on(table.tenantId, table.status),
  index('hostel_leave_passes_allocation_idx').on(table.allocationId),
]);

export const hostelLeavePassApprovals = pgTable('hostel_leave_pass_approvals', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  leavePassId: uuid('leave_pass_id').notNull(),
  approverId: text('approver_id').notNull(),
  approverRole: varchar('approver_role', { length: 20 }).notNull(), // warden | guardian | school_admin
  decision: varchar('decision', { length: 20 }).notNull(), // approved | denied
  reason: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_leave_pass_approvals_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.leavePassId],
    foreignColumns: [hostelLeavePasses.id],
    name: 'hostel_leave_pass_approvals_leave_pass_id_hostel_leave_passes_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.approverId],
    foreignColumns: [user.id],
    name: 'hostel_leave_pass_approvals_approver_id_user_id_fk',
  }).onDelete('restrict'),
]);

export const hostelLeavePassReturns = pgTable('hostel_leave_pass_returns', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  leavePassId: uuid('leave_pass_id').notNull(),
  allocationId: uuid('allocation_id').notNull(),
  returnedAt: timestamp('returned_at', { mode: 'string' }).notNull(),
  recordedById: text('recorded_by_id').notNull(),
  note: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_leave_pass_returns_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.leavePassId],
    foreignColumns: [hostelLeavePasses.id],
    name: 'hostel_leave_pass_returns_leave_pass_id_hostel_leave_passes_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.allocationId],
    foreignColumns: [hostelAllocations.id],
    name: 'hostel_leave_pass_returns_allocation_id_hostel_allocations_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.recordedById],
    foreignColumns: [user.id],
    name: 'hostel_leave_pass_returns_recorded_by_id_user_id_fk',
  }).onDelete('restrict'),
  unique('hostel_leave_pass_returns_tenant_leave_pass_unique').on(table.tenantId, table.leavePassId),
]);

// ---------------------------------------------------------------------------
// Idempotent escalation records
// ---------------------------------------------------------------------------

export const hostelEscalations = pgTable('hostel_escalations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  allocationId: uuid('allocation_id'),
  escalationType: varchar('escalation_type', { length: 30 }).notNull(), // missing_rollcall | overdue_return | unconfirmed_rollcall
  triggerDate: date('trigger_date').notNull(),
  tier: integer('tier').default(1).notNull(),
  recipientType: varchar('recipient_type', { length: 20 }).notNull(), // guardian | warden | school_admin
  channel: varchar('channel', { length: 10 }).default('log').notNull(), // log | sms (sms is deferred - no provider)
  acknowledgedAt: timestamp('acknowledged_at', { mode: 'string' }),
  acknowledgedById: text('acknowledged_by_id'),
  closureReason: text('closure_reason'),
  idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_escalations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.allocationId],
    foreignColumns: [hostelAllocations.id],
    name: 'hostel_escalations_allocation_id_hostel_allocations_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.acknowledgedById],
    foreignColumns: [user.id],
    name: 'hostel_escalations_acknowledged_by_id_user_id_fk',
  }).onDelete('set null'),
  unique('hostel_escalations_tenant_idempotency_key_unique').on(table.tenantId, table.idempotencyKey),
  index('hostel_escalations_tenant_type_date_idx').on(table.tenantId, table.escalationType, table.triggerDate),
]);

// ---------------------------------------------------------------------------
// Finance charge links (adapter boundary - Finance stays authoritative)
// ---------------------------------------------------------------------------

export const hostelChargeLinks = pgTable('hostel_charge_links', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  allocationId: uuid('allocation_id').notNull(),
  feeStructureId: uuid('fee_structure_id'),
  invoiceId: uuid('invoice_id'),
  invoiceItemId: uuid('invoice_item_id'),
  chargeType: varchar('charge_type', { length: 20 }).notNull(), // residence_fee | deposit | damage
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | linked | failed | reconciled | voided
  error: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'hostel_charge_links_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.allocationId],
    foreignColumns: [hostelAllocations.id],
    name: 'hostel_charge_links_allocation_id_hostel_allocations_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.feeStructureId],
    foreignColumns: [feeStructures.id],
    name: 'hostel_charge_links_fee_structure_id_fee_structures_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [invoices.id],
    name: 'hostel_charge_links_invoice_id_invoices_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.invoiceItemId],
    foreignColumns: [invoiceItems.id],
    name: 'hostel_charge_links_invoice_item_id_invoice_items_id_fk',
  }).onDelete('set null'),
  index('hostel_charge_links_tenant_allocation_idx').on(table.tenantId, table.allocationId),
]);
