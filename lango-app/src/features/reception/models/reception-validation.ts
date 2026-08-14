import { z } from 'zod';

// Receptionist Portal — request validation schemas. Strict bodies; every value
// is bounded. Timestamps are ISO strings normalized by Date.toISOString().

const instant = z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), 'Date/heure invalide');

export const receptionLookupSchema = z.object({
  q: z.string().trim().min(3).max(100),
}).strict();

// Inquiry intake through the CRM service (create + route only — never convert).
export const receptionInquiryCreateSchema = z.object({
  contactName: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().max(255).nullable().optional(),
  source: z.enum(['walk_in', 'phone', 'web', 'referral', 'facebook_ads', 'google_ads']).default('walk_in'),
  interestLevel: z.enum(['low', 'medium', 'high']).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  assignedToId: z.string().trim().max(100).nullable().optional(),
}).strict();

export const receptionFollowUpCreateSchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note']),
  notes: z.string().trim().min(1).max(5000),
  scheduledFor: instant.nullable().optional(),
}).strict();

export const receptionAppointmentCreateSchema = z.object({
  guestType: z.enum(['parent', 'visitor', 'prospect', 'supplier', 'other']).default('parent'),
  guestName: z.string().trim().min(1).max(255),
  guestPhone: z.string().trim().max(50).nullable().optional(),
  purpose: z.string().trim().min(1).max(255),
  hostId: z.string().trim().min(1).max(100),
  startAt: instant,
  endAt: instant,
  notes: z.string().trim().max(2000).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(255).nullable().optional(),
  // Approved-template notification only — never free-form text.
  notificationTemplate: z.enum(['appointment_scheduled', 'appointment_reminder']).nullable().optional(),
}).strict();

export const receptionAppointmentTransitionSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
}).strict();

export const receptionAppointmentRescheduleSchema = z.object({
  startAt: instant,
  endAt: instant,
  reason: z.string().trim().max(500).nullable().optional(),
}).strict();

export const receptionHandoffCreateSchema = z.object({
  category: z.enum(['admissions', 'finance', 'teacher', 'admin', 'security']),
  subjectType: z.enum(['student', 'guardian', 'inquiry', 'visitor', 'other']).nullable().optional(),
  subjectId: z.string().trim().max(100).nullable().optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assignedToId: z.string().trim().max(100).nullable().optional(),
  deadline: instant.nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(255).nullable().optional(),
}).strict();

export const receptionHandoffTransitionSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
}).strict();

export const receptionHandoffResolveSchema = z.object({
  resolutionNotes: z.string().trim().min(1).max(2000),
}).strict();

// Front-desk walk-in visitor. The receptionist's sign-in IS the approval
// (approved: true at the service boundary), so a pass can be issued at once.
// Mirrors guardVisitCreateSchema minus the invitationId/approved knobs.
export const receptionVisitorCreateSchema = z.object({
  visitorFirstName: z.string().trim().min(1).max(120),
  visitorLastName: z.string().trim().min(1).max(120),
  visitorPhone: z.string().trim().min(1).max(50).nullable().optional(),
  visitorEmail: z.string().trim().max(255).nullable().optional(),
  purpose: z.string().trim().min(1).max(255),
  hostId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict();

export const receptionVisitorGateActionSchema = z.object({
  gateId: z.uuid(),
  idempotencyKey: z.string().trim().min(1).max(255).nullable().optional(),
}).strict();

export const receptionVerificationCreateSchema = z.object({
  subjectType: z.enum(['student', 'guardian', 'visitor']),
  subjectId: z.string().trim().min(1).max(100),
  method: z.enum(['id_document', 'badge_qr', 'guardian_link', 'manual']),
  outcome: z.enum(['verified', 'failed', 'unverified']),
  notes: z.string().trim().max(500).nullable().optional(),
}).strict();
