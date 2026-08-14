import { z } from 'zod';

// Guard & Security Portal — request validation schemas.
// Admin config (Phase 2): gates, shifts, effective-dated assignments.

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM requis');
const optionalUuid = z.uuid().nullable().optional();

// Timestamps are stored as ISO strings (timestamp mode 'string'). Accept a full
// datetime or a plain date; the service normalizes both via Date.toISOString().
const instant = z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), 'Date/heure invalide');

export const guardGateCreateSchema = z.object({
  gateCode: z.string().trim().min(1).max(30),
  gateName: z.string().trim().min(1).max(120),
  branchId: optionalUuid,
  direction: z.enum(['entry', 'exit', 'both']).default('both'),
}).strict();

export const guardGateUpdateSchema = guardGateCreateSchema.partial().strict();

export const guardShiftCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  branchId: optionalUuid,
  startTime: hhmm,
  endTime: hhmm,
}).strict();

export const guardShiftUpdateSchema = guardShiftCreateSchema.partial().strict();

export const guardAssignmentCreateSchema = z.object({
  guardUserId: z.string().trim().min(1).max(100),
  gateId: z.uuid(),
  shiftId: z.uuid(),
  deviceId: optionalUuid,
  effectiveFrom: instant,
  effectiveUntil: instant.nullable().optional(),
}).strict();

export const guardAssignmentUpdateSchema = guardAssignmentCreateSchema.partial().strict();

// Kiosk session start + badge verification (Phase 3).
export const guardKioskStartSchema = z.object({
  gateId: z.uuid(),
  deviceId: optionalUuid,
}).strict();

// idempotencyKey is required so a replayed verify is deduplicated server-side
// (partial unique index on guardGateScanEvents) — the kiosk always sends one.
export const gateCredentialVerifySchema = z.object({
  kioskSessionId: z.uuid(),
  rawToken: z.string().trim().min(1).max(512),
  direction: z.enum(['entry', 'exit']),
  idempotencyKey: z.string().trim().min(1).max(255),
}).strict();

// Visitor invitations (Phase 4). expectedDate is a full ISO timestamp of the
// expected visit day; expectedStart/expectedEnd are HH:MM windows.
export const guardInvitationCreateSchema = z.object({
  visitorFirstName: z.string().trim().min(1).max(120),
  visitorLastName: z.string().trim().min(1).max(120),
  visitorPhone: z.string().trim().min(1).max(50).nullable().optional(),
  visitorEmail: z.string().trim().max(255).nullable().optional(),
  purpose: z.string().trim().min(1).max(255),
  hostId: z.string().trim().min(1).max(100),
  expectedDate: instant,
  expectedStart: hhmm,
  expectedEnd: hhmm,
}).strict();

// Walk-in visit. approved=true inlines the guard approval so a pass can be
// issued immediately; an invitationId links a pre-registered invite.
export const guardVisitCreateSchema = z.object({
  visitorFirstName: z.string().trim().min(1).max(120),
  visitorLastName: z.string().trim().min(1).max(120),
  visitorPhone: z.string().trim().min(1).max(50).nullable().optional(),
  visitorEmail: z.string().trim().max(255).nullable().optional(),
  purpose: z.string().trim().min(1).max(255),
  hostId: z.string().trim().min(1).max(100).nullable().optional(),
  invitationId: z.uuid().nullable().optional(),
  approved: z.boolean().default(false),
}).strict();

export const guardVisitCheckInSchema = z.object({
  gateId: z.uuid(),
  idempotencyKey: z.string().trim().min(1).max(255).nullable().optional(),
}).strict();

export const guardVisitCheckOutSchema = z.object({
  gateId: z.uuid(),
  idempotencyKey: z.string().trim().min(1).max(255).nullable().optional(),
}).strict();

export const guardPickupAuthorizationCreateSchema = z.object({
  studentId: z.string().trim().min(1).max(100),
  pickupPersonId: z.uuid(),
  relationshipType: z.string().trim().min(1).max(100),
  authorizedFrom: instant,
  authorizedUntil: instant,
  reason: z.string().trim().max(255).nullable().optional(),
}).strict();

// Release consumes an authorization exactly once (row lock + partial unique).
export const guardReleaseSchema = z.object({
  studentId: z.string().trim().min(1).max(100),
  authorizationId: z.uuid(),
  method: z.enum(['badge_qr', 'manual']),
  gateId: z.uuid(),
  deviceId: optionalUuid,
  kioskSessionId: z.uuid().nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(255).nullable().optional(),
}).strict();

// Incident lifecycle.
export const guardIncidentCreateSchema = z.object({
  category: z.enum(['comportement', 'objet_perdu', 'acces', 'securite', 'medical', 'autre']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  location: z.string().trim().max(255).nullable().optional(),
  description: z.string().trim().min(1).max(5000),
  gateId: z.uuid().nullable().optional(),
  occurredAt: instant.optional(),
}).strict();

export const guardIncidentActionSchema = z.object({
  actionType: z.enum(['note', 'escalate', 'assign', 'resolve', 'close', 'reopen']),
  notes: z.string().trim().max(5000).nullable().optional(),
}).strict();

// Escalation requires a leadership target; resolution notes are leadership-gated
// at the service layer (never part of the default guard set).
export const guardIncidentUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'escalated', 'resolved', 'closed']).optional(),
  escalatedToId: z.string().trim().min(1).max(100).nullable().optional(),
  resolutionNotes: z.string().trim().max(5000).nullable().optional(),
}).strict();

// Emergency activation snapshots the active procedures at that instant.
export const guardEmergencyActivateSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
}).strict();

export const guardEmergencyAckSchema = z.object({
  deviceId: z.uuid().nullable().optional(),
  kioskSessionId: z.uuid().nullable().optional(),
}).strict();

export const guardEmergencyEndSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
}).strict();
