// Receptionist Portal — shared domain types. Values mirror the varchar
// statuses of the schema (no pgEnums), kept deliberately narrow.

export const RECEPTION_APPOINTMENT_STATUSES = ['scheduled', 'checked_in', 'completed', 'cancelled', 'no_show'] as const;
export type ReceptionAppointmentStatus = (typeof RECEPTION_APPOINTMENT_STATUSES)[number];

export const RECEPTION_HANDOFF_STATUSES = ['open', 'acknowledged', 'resolved', 'cancelled'] as const;
export type ReceptionHandoffStatus = (typeof RECEPTION_HANDOFF_STATUSES)[number];

export const RECEPTION_HANDOFF_CATEGORIES = ['admissions', 'finance', 'teacher', 'admin', 'security'] as const;
export type ReceptionHandoffCategory = (typeof RECEPTION_HANDOFF_CATEGORIES)[number];

// Forward transitions enforced at the service layer (FOR UPDATE + status guard).
// scheduled -> checked_in -> completed ; scheduled -> cancelled | no_show
export const APPOINTMENT_TRANSITIONS: Record<ReceptionAppointmentStatus, ReceptionAppointmentStatus[]> = {
  scheduled: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

// open -> acknowledged -> resolved ; open -> cancelled
export const HANDOFF_TRANSITIONS: Record<ReceptionHandoffStatus, ReceptionHandoffStatus[]> = {
  open: ['acknowledged', 'resolved', 'cancelled'],
  acknowledged: ['resolved'],
  resolved: [],
  cancelled: [],
};

export type LookupPersonType = 'student' | 'guardian' | 'parent';

// Identity-minimized lookup projection. Never returns national ID, salary,
// bank details, medical info, credentials, internal notes, grades, finance
// balances or unrestricted contacts (receptionist-portal plan §3).
export type LookupResult = {
  id: string;
  name: string;
  type: LookupPersonType;
  maskedPhone: string | null;
  maskedEmail: string | null;
  matricule?: string | null;
  className?: string | null;
  level?: string | null;
  branchId?: string | null;
  // Authorized guardian relationship status only — a boolean, never the
  // guardian directory or child roster.
  hasPickupAuthority?: boolean | null;
  isLinkedGuardian?: boolean | null;
};
