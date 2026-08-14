import {
  boolean,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants, user } from '../../../models/Schema';

export const identityBadgeStatus = pgEnum('identity_badge_status', [
  'active',
  'revoked',
  'expired',
  'replaced',
]);

export const identityBadgeSubjectType = pgEnum('identity_badge_subject_type', [
  'student',
  'staff',
  'visitor',
]);

export const identityBadgeCredentials = pgTable('identity_badge_credentials', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  subjectType: identityBadgeSubjectType('subject_type').default('student').notNull(),
  tokenHash: text('token_hash').notNull(),
  displayPrefix: varchar('display_prefix', { length: 20 }),
  status: identityBadgeStatus().default('active').notNull(),
  issuedAt: timestamp('issued_at', { mode: 'string' }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }),
  revokedAt: timestamp('revoked_at', { mode: 'string' }),
  issuerId: text('issuer_id'),
  replacementId: uuid('replacement_id'),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'identity_badge_credentials_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'identity_badge_credentials_user_id_user_id_fk',
  }).onDelete('cascade'),
  unique('identity_badge_credentials_token_hash_unique').on(table.tokenHash),
  index('identity_badge_credentials_tenant_user_idx').on(table.tenantId, table.userId),
]);

export const scannerDevices = pgTable('scanner_devices', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  deviceLabel: varchar('device_label', { length: 255 }).notNull(),
  branchId: uuid('branch_id'),
  pairedAt: timestamp('paired_at', { mode: 'string' }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { mode: 'string' }),
  isDisabled: boolean('is_disabled').default(false).notNull(),
  secretKey: text('secret_key'),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'scanner_devices_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
]);

export const scannerSessions = pgTable('scanner_sessions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  deviceId: uuid('device_id'),
  operatorId: text('operator_id').notNull(),
  classSectionId: uuid('class_section_id'),
  startedAt: timestamp('started_at', { mode: 'string' }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { mode: 'string' }),
  status: varchar({ length: 50 }).default('active').notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'scanner_sessions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.operatorId],
    foreignColumns: [user.id],
    name: 'scanner_sessions_operator_id_user_id_fk',
  }).onDelete('cascade'),
]);

export const attendanceScanEvents = pgTable('attendance_scan_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sessionId: uuid('session_id'),
  credentialId: uuid('credential_id'),
  studentId: text('student_id'),
  resultStatus: varchar('result_status', { length: 50 }).notNull(), // accepted, rejected, duplicate, already_scanned
  rejectionReason: text('rejection_reason'), // INVALID_CREDENTIAL, BADGE_*, WRONG_CLASS, REGISTER_LOCKED, ...
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  scannedAt: timestamp('scanned_at', { mode: 'string' }).defaultNow().notNull(),
  // Attendance QR staging context: which section/register the scan targeted,
  // the staged status it produced, and the attendance row it created.
  classSectionId: uuid('class_section_id'),
  registerId: uuid('register_id'),
  stagedStatus: varchar('staged_status', { length: 20 }),
  attendanceRecordId: uuid('attendance_record_id'),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'attendance_scan_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  index('attendance_scan_events_tenant_session_idx').on(table.tenantId, table.sessionId),
  index('attendance_scan_events_credential_session_idx').on(table.tenantId, table.credentialId, table.sessionId),
  index('attendance_scan_events_tenant_scan_idx').on(table.tenantId, table.scannedAt),
]);

export const workforcePunchEvents = pgTable('workforce_punch_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  employeeId: text('employee_id').notNull(),
  credentialId: uuid('credential_id'),
  punchType: varchar('punch_type', { length: 10 }).notNull(), // 'in', 'out'
  scannedAt: timestamp('scanned_at', { mode: 'string' }).defaultNow().notNull(),
  deviceId: uuid('device_id'),
  notes: text(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'workforce_punch_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [user.id],
    name: 'workforce_punch_events_employee_id_user_id_fk',
  }).onDelete('cascade'),
  index('workforce_punch_events_tenant_employee_idx').on(table.tenantId, table.employeeId),
]);
