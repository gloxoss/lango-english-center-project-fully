import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../../models/Schema';

// ---------------------------------------------------------------------------
// Receptionist Portal — core role feature (no addon).
// Every table carries tenantId and is written/read exclusively through the
// tenant-scoped reception services. Status/history values are varchar
// (matching the guard-schema style), not pgEnums.
//
// Security contract (see receptionist-portal EXECUTION-PLAN §0):
//  - tenant scoping is enforced at the query layer (no tenant FK object).
//  - history tables are immutable/append-only; no service path updates them.
//  - identity_verifications stores method + outcome only, never document bytes.
//  - idempotencyKey partial-unique indexes make replay/retry safe.
// ---------------------------------------------------------------------------

// Appointment lifecycle: scheduled -> checked_in -> completed ; scheduled ->
// cancelled | no_show. Enforced in the service layer with FOR UPDATE.
export const receptionAppointments = pgTable('reception_appointments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  guestType: varchar('guest_type', { length: 30 }).default('parent').notNull(), // parent | visitor | prospect | supplier | other
  guestName: varchar('guest_name', { length: 255 }).notNull(),
  guestPhone: varchar('guest_phone', { length: 50 }),
  purpose: varchar({ length: 255 }).notNull(),
  hostId: text('host_id').notNull(),
  hostName: varchar('host_name', { length: 255 }),
  startAt: timestamp('start_at', { mode: 'string' }).notNull(),
  endAt: timestamp('end_at', { mode: 'string' }).notNull(),
  status: varchar({ length: 20 }).default('scheduled').notNull(), // scheduled | checked_in | completed | cancelled | no_show
  notes: text(),
  version: integer().default(0).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.hostId],
    foreignColumns: [user.id],
    name: 'reception_appointments_host_id_user_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'reception_appointments_created_by_id_user_id_fk',
  }).onDelete('cascade'),
  index('reception_appointments_tenant_start_idx').on(table.tenantId, table.startAt),
  index('reception_appointments_tenant_status_idx').on(table.tenantId, table.status),
  uniqueIndex('reception_appointments_idempotency_unique')
    .on(table.idempotencyKey)
    .where(sql`idempotency_key IS NOT NULL`),
]);

// Immutable appointment status history — append-only, no UPDATE path anywhere.
export const receptionAppointmentStatusHistory = pgTable('reception_appointment_status_history', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  appointmentId: uuid('appointment_id').notNull(),
  fromStatus: varchar('from_status', { length: 20 }),
  toStatus: varchar('to_status', { length: 20 }).notNull(),
  changedById: text('changed_by_id').notNull(),
  reason: varchar({ length: 500 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.appointmentId],
    foreignColumns: [receptionAppointments.id],
    name: 'reception_appointment_status_history_appointment_id_reception_appointments_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.changedById],
    foreignColumns: [user.id],
    name: 'reception_appointment_status_history_changed_by_id_user_id_fk',
  }).onDelete('cascade'),
  index('reception_appointment_status_history_tenant_appt_idx').on(table.tenantId, table.appointmentId),
]);

// Identity verification outcome — method + outcome only. Never stores document
// images or raw copies (receptionist-portal plan: "verify … without storing
// unnecessary document copies").
export const receptionIdentityVerifications = pgTable('reception_identity_verifications', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  subjectType: varchar('subject_type', { length: 20 }).notNull(), // student | guardian | visitor
  subjectId: text('subject_id').notNull(),
  method: varchar({ length: 30 }).notNull(), // id_document | badge_qr | guardian_link | manual
  outcome: varchar({ length: 20 }).notNull(), // verified | failed | unverified
  notes: varchar({ length: 500 }),
  verifierId: text('verifier_id').notNull(),
  performedAt: timestamp('performed_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.verifierId],
    foreignColumns: [user.id],
    name: 'reception_identity_verifications_verifier_id_user_id_fk',
  }).onDelete('cascade'),
  index('reception_identity_verifications_tenant_performed_idx').on(table.tenantId, table.performedAt),
  index('reception_identity_verifications_tenant_subject_idx').on(table.tenantId, table.subjectType, table.subjectId),
]);

// Handoff lifecycle: open -> acknowledged -> resolved ; open -> cancelled.
// A handoff records intent/assignment/status — it never performs the
// destination module's privileged action (no voucher, no admission approve).
export const receptionHandoffs = pgTable('reception_handoffs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  category: varchar({ length: 30 }).notNull(), // admissions | finance | teacher | admin | security
  subjectType: varchar('subject_type', { length: 20 }),
  subjectId: text('subject_id'),
  title: varchar({ length: 255 }).notNull(),
  description: text(),
  priority: varchar({ length: 10 }).default('medium').notNull(), // low | medium | high | urgent
  assignedToId: text('assigned_to_id'),
  deadline: timestamp({ mode: 'string' }),
  status: varchar({ length: 20 }).default('open').notNull(), // open | acknowledged | resolved | cancelled
  resolutionNotes: text('resolution_notes'),
  acknowledgedById: text('acknowledged_by_id'),
  acknowledgedAt: timestamp('acknowledged_at', { mode: 'string' }),
  resolvedById: text('resolved_by_id'),
  resolvedAt: timestamp('resolved_at', { mode: 'string' }),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.assignedToId],
    foreignColumns: [user.id],
    name: 'reception_handoffs_assigned_to_id_user_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'reception_handoffs_created_by_id_user_id_fk',
  }).onDelete('cascade'),
  index('reception_handoffs_tenant_status_idx').on(table.tenantId, table.status),
  index('reception_handoffs_tenant_assigned_idx').on(table.tenantId, table.assignedToId),
  uniqueIndex('reception_handoffs_idempotency_unique')
    .on(table.idempotencyKey)
    .where(sql`idempotency_key IS NOT NULL`),
]);

// Immutable handoff status history — append-only.
export const receptionHandoffStatusHistory = pgTable('reception_handoff_status_history', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  handoffId: uuid('handoff_id').notNull(),
  fromStatus: varchar('from_status', { length: 20 }),
  toStatus: varchar('to_status', { length: 20 }).notNull(),
  changedById: text('changed_by_id').notNull(),
  reason: varchar({ length: 500 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.handoffId],
    foreignColumns: [receptionHandoffs.id],
    name: 'reception_handoff_status_history_handoff_id_reception_handoffs_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.changedById],
    foreignColumns: [user.id],
    name: 'reception_handoff_status_history_changed_by_id_user_id_fk',
  }).onDelete('cascade'),
  index('reception_handoff_status_history_tenant_handoff_idx').on(table.tenantId, table.handoffId),
]);
