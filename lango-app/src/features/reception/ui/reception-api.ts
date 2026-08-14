// Receptionist Portal — shared client API helper + domain types.

export type ApiErrorShape = { code?: string; message?: string };

export async function api<T>(
  url: string,
  options?: { method?: string; body?: unknown },
): Promise<{
  ok: boolean;
  status: number;
  data?: T;
  total?: number;
  created?: boolean;
  error?: ApiErrorShape;
}> {
  try {
    const res = await fetch(url, {
      method: options?.method ?? 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

export type Appointment = {
  id: string;
  branchId: string | null;
  guestType: string;
  guestName: string;
  guestPhone: string | null;
  purpose: string;
  hostId: string;
  hostName: string | null;
  startAt: string;
  endAt: string;
  status: 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type Handoff = {
  id: string;
  branchId: string | null;
  category: 'admissions' | 'finance' | 'teacher' | 'admin' | 'security';
  subjectType: string | null;
  subjectId: string | null;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedToId: string | null;
  assignedToName: string | null;
  deadline: string | null;
  status: 'open' | 'acknowledged' | 'resolved' | 'cancelled';
  resolutionNotes: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type LookupResult = {
  id: string;
  name: string;
  type: 'student' | 'guardian' | 'parent';
  maskedPhone: string | null;
  maskedEmail: string | null;
  matricule?: string | null;
  className?: string | null;
  level?: string | null;
  branchId?: string | null;
  hasPickupAuthority?: boolean | null;
  isLinkedGuardian?: boolean | null;
};

export type Visitor = {
  id: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorPhone: string | null;
  visitorEmail: string | null;
  purpose: string;
  hostName: string | null;
  passNumber: string | null;
  hasPass: boolean;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  createdAt: string;
};

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Planifié',
  checked_in: 'Pointé',
  completed: 'Terminé',
  cancelled: 'Annulé',
  no_show: 'Absent',
};

export const HANDOFF_STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  acknowledged: 'Prise en charge',
  resolved: 'Résolue',
  cancelled: 'Annulée',
};

export const HANDOFF_PRIORITY_LABELS: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};
