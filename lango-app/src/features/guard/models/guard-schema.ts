import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  tenants,
  user,
  branches,
  scannerDevices,
  identityBadgeCredentials,
  guardians,
} from '../../../models/Schema';

// ---------------------------------------------------------------------------
// Guard & Security Portal — core role feature (no addon).
// All tables carry tenantId and are written/read exclusively through the
// tenant-scoped guard services. Status values are varchar (matching the
// attendance/scan evidence style), not pgEnums.
// ---------------------------------------------------------------------------

// Soft-archive only: DELETE sets isActive=false when any child references it.
export const guardGates = pgTable('guard_gates', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  gateCode: varchar('gate_code', { length: 30 }).notNull(),
  gateName: varchar('gate_name', { length: 120 }).notNull(),
  direction: varchar('direction', { length: 10 }).default('both').notNull(), // entry | exit | both
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_gates_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.branchId],
    foreignColumns: [branches.id],
    name: 'guard_gates_branch_id_branches_id_fk',
  }).onDelete('set null'),
  unique('guard_gates_tenant_code_unique').on(table.tenantId, table.gateCode),
]);

// Guard shift windows (HH:MM convention), distinct from the academic shifts table.
export const guardShifts = pgTable('guard_shifts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  name: varchar({ length: 120 }).notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_shifts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.branchId],
    foreignColumns: [branches.id],
    name: 'guard_shifts_branch_id_branches_id_fk',
  }).onDelete('set null'),
]);

// Effective-dated guard ↔ gate ↔ shift ↔ device binding. A guard is active at a
// gate only when status='active' AND effectiveFrom <= now < effectiveUntil.
export const guardAssignments = pgTable('guard_assignments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  guardUserId: text('guard_user_id').notNull(),
  gateId: uuid('gate_id').notNull(),
  shiftId: uuid('shift_id').notNull(),
  deviceId: uuid('device_id'),
  effectiveFrom: timestamp('effective_from', { mode: 'string' }).notNull(),
  effectiveUntil: timestamp('effective_until', { mode: 'string' }),
  status: varchar({ length: 20 }).default('scheduled').notNull(), // scheduled | active | expired | cancelled
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_assignments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.guardUserId],
    foreignColumns: [user.id],
    name: 'guard_assignments_guard_user_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.gateId],
    foreignColumns: [guardGates.id],
    name: 'guard_assignments_gate_id_guard_gates_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.shiftId],
    foreignColumns: [guardShifts.id],
    name: 'guard_assignments_shift_id_guard_shifts_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.deviceId],
    foreignColumns: [scannerDevices.id],
    name: 'guard_assignments_device_id_scanner_devices_id_fk',
  }).onDelete('set null'),
  // One active assignment per guard and one active assignment per device.
  uniqueIndex('guard_assignments_guard_active_unique')
    .on(table.guardUserId)
    .where(sql`status = 'active'`),
  uniqueIndex('guard_assignments_device_active_unique')
    .on(table.deviceId)
    .where(sql`status = 'active'`),
  index('guard_assignments_tenant_gate_idx').on(table.tenantId, table.gateId),
]);

// Kiosk session bound to tenant, branch, gate, device and operator.
export const guardKioskSessions = pgTable('guard_kiosk_sessions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  gateId: uuid('gate_id').notNull(),
  deviceId: uuid('device_id'),
  operatorId: text('operator_id').notNull(),
  assignmentId: uuid('assignment_id').notNull(),
  startedAt: timestamp('started_at', { mode: 'string' }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { mode: 'string' }),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
  lockedAt: timestamp('locked_at', { mode: 'string' }),
  status: varchar({ length: 20 }).default('active').notNull(), // active | locked | closed
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_kiosk_sessions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.gateId],
    foreignColumns: [guardGates.id],
    name: 'guard_kiosk_sessions_gate_id_guard_gates_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.operatorId],
    foreignColumns: [user.id],
    name: 'guard_kiosk_sessions_operator_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.assignmentId],
    foreignColumns: [guardAssignments.id],
    name: 'guard_kiosk_sessions_assignment_id_guard_assignments_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.deviceId],
    foreignColumns: [scannerDevices.id],
    name: 'guard_kiosk_sessions_device_id_scanner_devices_id_fk',
  }).onDelete('set null'),
  // One active kiosk session per device and per (operator, gate).
  uniqueIndex('guard_kiosk_sessions_device_active_unique')
    .on(table.deviceId)
    .where(sql`status = 'active'`),
  uniqueIndex('guard_kiosk_sessions_operator_gate_active_unique')
    .on(table.operatorId, table.gateId)
    .where(sql`status = 'active'`),
  index('guard_kiosk_sessions_tenant_operator_idx').on(table.tenantId, table.operatorId),
]);

// Visitor invitation → approval → pass lifecycle.
export const guardVisitorInvitations = pgTable('guard_visitor_invitations', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  visitorFirstName: varchar('visitor_first_name', { length: 120 }).notNull(),
  visitorLastName: varchar('visitor_last_name', { length: 120 }).notNull(),
  visitorPhone: varchar('visitor_phone', { length: 50 }),
  visitorEmail: varchar('visitor_email', { length: 255 }),
  purpose: varchar({ length: 255 }).notNull(),
  hostId: text('host_id').notNull(),
  expectedDate: timestamp('expected_date', { mode: 'string' }).notNull(),
  expectedStart: varchar('expected_start', { length: 5 }).notNull(),
  expectedEnd: varchar('expected_end', { length: 5 }).notNull(),
  status: varchar({ length: 20 }).default('invited').notNull(), // invited | approved | rejected | expired | cancelled
  approvedById: text('approved_by_id'),
  approvedAt: timestamp('approved_at', { mode: 'string' }),
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_visitor_invitations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.hostId],
    foreignColumns: [user.id],
    name: 'guard_visitor_invitations_host_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'guard_visitor_invitations_created_by_id_user_id_fk',
  }).onDelete('cascade'),
  index('guard_visitor_invitations_tenant_expected_idx').on(table.tenantId, table.expectedDate),
]);

// The actual visit / pass lifecycle. Walk-ins have invitationId = null.
export const guardVisits = pgTable('guard_visits', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  invitationId: uuid('invitation_id'),
  visitorFirstName: varchar('visitor_first_name', { length: 120 }).notNull(),
  visitorLastName: varchar('visitor_last_name', { length: 120 }).notNull(),
  visitorPhone: varchar('visitor_phone', { length: 50 }),
  visitorEmail: varchar('visitor_email', { length: 255 }),
  purpose: varchar({ length: 255 }).notNull(),
  hostId: text('host_id'),
  hostName: varchar('host_name', { length: 255 }),
  passNumber: varchar('pass_number', { length: 30 }),
  badgeCredentialId: uuid('badge_credential_id'),
  status: varchar({ length: 20 }).default('pending').notNull(), // pending | approved | rejected | checked_in | checked_out | no_show | cancelled
  checkInAt: timestamp('check_in_at', { mode: 'string' }),
  checkOutAt: timestamp('check_out_at', { mode: 'string' }),
  checkInBy: text('check_in_by'),
  checkOutBy: text('check_out_by'),
  gateId: uuid('gate_id'),
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_visits_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.invitationId],
    foreignColumns: [guardVisitorInvitations.id],
    name: 'guard_visits_invitation_id_guard_visitor_invitations_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.hostId],
    foreignColumns: [user.id],
    name: 'guard_visits_host_id_user_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.badgeCredentialId],
    foreignColumns: [identityBadgeCredentials.id],
    name: 'guard_visits_badge_credential_id_identity_badge_credentials_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.checkInBy],
    foreignColumns: [user.id],
    name: 'guard_visits_check_in_by_user_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.checkOutBy],
    foreignColumns: [user.id],
    name: 'guard_visits_check_out_by_user_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.gateId],
    foreignColumns: [guardGates.id],
    name: 'guard_visits_gate_id_guard_gates_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'guard_visits_created_by_id_user_id_fk',
  }).onDelete('cascade'),
  unique('guard_visits_tenant_pass_number_unique').on(table.tenantId, table.passNumber),
  index('guard_visits_tenant_status_idx').on(table.tenantId, table.status),
]);

// Effective-dated, one-time pickup authorization. Read-only to guard; released
// through guardReleaseEvents.
export const guardPickupAuthorizations = pgTable('guard_pickup_authorizations', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  pickupPersonId: uuid('pickup_person_id').notNull(),
  relationshipType: varchar('relationship_type', { length: 100 }).notNull(),
  authorizedFrom: timestamp('authorized_from', { mode: 'string' }).notNull(),
  authorizedUntil: timestamp('authorized_until', { mode: 'string' }).notNull(),
  reason: varchar({ length: 255 }),
  status: varchar({ length: 20 }).default('active').notNull(), // active | expired | cancelled | consumed
  consumedAt: timestamp('consumed_at', { mode: 'string' }),
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_pickup_authorizations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'guard_pickup_authorizations_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.pickupPersonId],
    foreignColumns: [guardians.id],
    name: 'guard_pickup_authorizations_pickup_person_id_guardians_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdById],
    foreignColumns: [user.id],
    name: 'guard_pickup_authorizations_created_by_id_user_id_fk',
  }).onDelete('cascade'),
  index('guard_pickup_authorizations_tenant_student_idx').on(table.tenantId, table.studentId),
]);

// Immutable release evidence — append-only, no UPDATE path in any service.
export const guardReleaseEvents = pgTable('guard_release_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  studentId: text('student_id').notNull(),
  authorizationId: uuid('authorization_id').notNull(),
  releaseMethod: varchar('release_method', { length: 20 }).notNull(), // badge_qr | manual
  operatorId: text('operator_id').notNull(),
  gateId: uuid('gate_id').notNull(),
  deviceId: uuid('device_id'),
  kioskSessionId: uuid('kiosk_session_id'),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  releasedAt: timestamp('released_at', { mode: 'string' }).defaultNow().notNull(),
  evidence: jsonb('evidence').notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_release_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'guard_release_events_student_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.authorizationId],
    foreignColumns: [guardPickupAuthorizations.id],
    name: 'guard_release_events_authorization_id_guard_pickup_authorizations_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.operatorId],
    foreignColumns: [user.id],
    name: 'guard_release_events_operator_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.gateId],
    foreignColumns: [guardGates.id],
    name: 'guard_release_events_gate_id_guard_gates_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.kioskSessionId],
    foreignColumns: [guardKioskSessions.id],
    name: 'guard_release_events_kiosk_session_id_guard_kiosk_sessions_id_fk',
  }).onDelete('set null'),
  // Database backstop: one release event per authorization.
  uniqueIndex('guard_release_events_authorization_unique')
    .on(table.authorizationId)
    .where(sql`release_method IS NOT NULL`),
  index('guard_release_events_tenant_released_idx').on(table.tenantId, table.releasedAt),
]);

// Immutable gate scan evidence.
export const guardGateScanEvents = pgTable('guard_gate_scan_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  kioskSessionId: uuid('kiosk_session_id'),
  gateId: uuid('gate_id').notNull(),
  deviceId: uuid('device_id'),
  direction: varchar({ length: 10 }).notNull(), // entry | exit
  credentialId: uuid('credential_id'),
  subjectType: varchar('subject_type', { length: 20 }),
  studentId: text('student_id'),
  visitId: uuid('visit_id'),
  resultStatus: varchar('result_status', { length: 20 }).notNull(), // accepted | rejected | already_processed | released
  rejectionReason: varchar('rejection_reason', { length: 60 }),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  scannedAt: timestamp('scanned_at', { mode: 'string' }).defaultNow().notNull(),
  actorId: text('actor_id').notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_gate_scan_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.kioskSessionId],
    foreignColumns: [guardKioskSessions.id],
    name: 'guard_gate_scan_events_kiosk_session_id_guard_kiosk_sessions_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.gateId],
    foreignColumns: [guardGates.id],
    name: 'guard_gate_scan_events_gate_id_guard_gates_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [user.id],
    name: 'guard_gate_scan_events_student_id_user_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.visitId],
    foreignColumns: [guardVisits.id],
    name: 'guard_gate_scan_events_visit_id_guard_visits_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.actorId],
    foreignColumns: [user.id],
    name: 'guard_gate_scan_events_actor_id_user_id_fk',
  }).onDelete('cascade'),
  // Replay-dedupe: same idempotency key can only be recorded once.
  uniqueIndex('guard_gate_scan_events_idempotency_unique')
    .on(table.idempotencyKey)
    .where(sql`idempotency_key IS NOT NULL`),
  index('guard_gate_scan_events_tenant_scan_idx').on(table.tenantId, table.scannedAt),
]);

// Incidents, escalation trail and evidence attachments.
export const guardIncidents = pgTable('guard_incidents', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  gateId: uuid('gate_id'),
  category: varchar({ length: 50 }).notNull(), // comportement | objet_perdu | acces | securite | medical | autre
  severity: varchar({ length: 20 }).default('low').notNull(), // low | medium | high | critical
  location: varchar({ length: 255 }),
  description: text().notNull(),
  reportedById: text('reported_by_id').notNull(),
  occurredAt: timestamp('occurred_at', { mode: 'string' }).defaultNow().notNull(),
  status: varchar({ length: 20 }).default('open').notNull(), // open | in_progress | escalated | resolved | closed
  escalatedToId: text('escalated_to_id'),
  escalatedAt: timestamp('escalated_at', { mode: 'string' }),
  resolvedById: text('resolved_by_id'),
  resolvedAt: timestamp('resolved_at', { mode: 'string' }),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_incidents_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.gateId],
    foreignColumns: [guardGates.id],
    name: 'guard_incidents_gate_id_guard_gates_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.reportedById],
    foreignColumns: [user.id],
    name: 'guard_incidents_reported_by_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.escalatedToId],
    foreignColumns: [user.id],
    name: 'guard_incidents_escalated_to_id_user_id_fk',
  }).onDelete('set null'),
  index('guard_incidents_tenant_status_idx').on(table.tenantId, table.status),
]);

// Append-only follow-up / escalation trail.
export const guardIncidentActions = pgTable('guard_incident_actions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  incidentId: uuid('incident_id').notNull(),
  actionType: varchar('action_type', { length: 30 }).notNull(), // note | escalate | assign | resolve | close | reopen
  notes: text(),
  actorId: text('actor_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_incident_actions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.incidentId],
    foreignColumns: [guardIncidents.id],
    name: 'guard_incident_actions_incident_id_guard_incidents_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.actorId],
    foreignColumns: [user.id],
    name: 'guard_incident_actions_actor_id_user_id_fk',
  }).onDelete('cascade'),
  index('guard_incident_actions_tenant_incident_idx').on(table.tenantId, table.incidentId),
]);

export const guardIncidentAttachments = pgTable('guard_incident_attachments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  incidentId: uuid('incident_id').notNull(),
  storageKey: text('storage_key').notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }).notNull(),
  fileSize: integer('file_size').notNull(),
  uploadedById: text('uploaded_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_incident_attachments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.incidentId],
    foreignColumns: [guardIncidents.id],
    name: 'guard_incident_attachments_incident_id_guard_incidents_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.uploadedById],
    foreignColumns: [user.id],
    name: 'guard_incident_attachments_uploaded_by_id_user_id_fk',
  }).onDelete('set null'),
]);

export const guardEmergencyProcedures = pgTable('guard_emergency_procedures', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  title: varchar({ length: 255 }).notNull(),
  body: text().notNull(),
  version: integer().default(1).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  updatedById: text('updated_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_emergency_procedures_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.updatedById],
    foreignColumns: [user.id],
    name: 'guard_emergency_procedures_updated_by_id_user_id_fk',
  }).onDelete('cascade'),
]);

export const guardEmergencyContacts = pgTable('guard_emergency_contacts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  name: varchar({ length: 255 }).notNull(),
  role: varchar({ length: 120 }).notNull(),
  phone: varchar({ length: 50 }).notNull(),
  priority: integer().default(10).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_emergency_contacts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
]);

export const guardEmergencyActivations = pgTable('guard_emergency_activations', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  activatedById: text('activated_by_id').notNull(),
  activatedAt: timestamp('activated_at', { mode: 'string' }).defaultNow().notNull(),
  procedureSnapshot: jsonb('procedure_snapshot').notNull(),
  status: varchar({ length: 20 }).default('active').notNull(), // active | ended
  endedById: text('ended_by_id'),
  endedAt: timestamp('ended_at', { mode: 'string' }),
  reason: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_emergency_activations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.activatedById],
    foreignColumns: [user.id],
    name: 'guard_emergency_activations_activated_by_id_user_id_fk',
  }).onDelete('cascade'),
]);

export const guardEmergencyAcknowledgements = pgTable('guard_emergency_acknowledgements', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  activationId: uuid('activation_id').notNull(),
  acknowledgedById: text('acknowledged_by_id').notNull(),
  acknowledgedAt: timestamp('acknowledged_at', { mode: 'string' }).defaultNow().notNull(),
  deviceId: uuid('device_id'),
  kioskSessionId: uuid('kiosk_session_id'),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'guard_emergency_acknowledgements_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.activationId],
    foreignColumns: [guardEmergencyActivations.id],
    name: 'guard_emergency_acknowledgements_activation_id_guard_emergency_activations_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.acknowledgedById],
    foreignColumns: [user.id],
    name: 'guard_emergency_acknowledgements_acknowledged_by_id_user_id_fk',
  }).onDelete('cascade'),
  // Idempotent per guard: one acknowledgement per (activation, guard).
  unique('guard_emergency_ack_activation_guard_unique').on(table.activationId, table.acknowledgedById),
]);
