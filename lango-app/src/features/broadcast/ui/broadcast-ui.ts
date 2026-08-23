// Shared API client, label maps and formatting for the Broadcast UI. Kept in
// one place so every view renders channel/status enums in the same French
// vocabulary and handles fetch/error consistently.
export type ApiErrorShape = { code?: string; message?: string };

export const ADDON_NOT_ACTIVATED = 'ADDON_NOT_ACTIVATED';
export function isAddonNotActivated(error?: ApiErrorShape): boolean {
  return error?.code === ADDON_NOT_ACTIVATED;
}

export async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...(json as object) } as { ok: boolean; status: number; data?: T; error?: ApiErrorShape };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
};

export const fmtCount = (n: number | null | undefined) => (n ?? 0).toLocaleString('fr-FR');

export const CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  messenger: 'Messenger',
};

export const CHANNEL_BADGE: Record<string, string> = {
  sms: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  email: 'bg-blue-50 text-blue-700 border-blue-200',
  whatsapp: 'bg-green-50 text-green-700 border-green-200',
  telegram: 'bg-sky-50 text-sky-700 border-sky-200',
  messenger: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  pending_approval: 'En attente d’approbation',
  scheduled: 'Planifiée',
  queued: 'En file',
  sending: 'En cours d’envoi',
  completed: 'Terminée',
  failed: 'Échouée',
  cancelled: 'Annulée',
};

export const CAMPAIGN_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_approval: 'bg-amber-50 text-amber-700 border-amber-200',
  scheduled: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  queued: 'bg-violet-50 text-violet-700 border-violet-200',
  sending: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  queued: 'En file',
  sent: 'Envoyé',
  delivered: 'Délivré',
  failed: 'Échec',
  bounced: 'Rebondi',
  complained: 'Plainte',
};

export const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  queued: 'En file',
  skipped: 'Exclu',
  sent: 'Envoyé',
  failed: 'Échec',
};

export const RECIPIENT_KIND_LABELS: Record<string, string> = {
  inquiry: 'Demande',
  student: 'Élève',
  guardian: 'Tuteur',
  staff: 'Personnel',
  alumni: 'Ancien élève',
  external: 'Externe',
};

export const SKIP_REASON_LABELS: Record<string, string> = {
  invalid_contact: 'Contact invalide',
  consent_revoked: 'Consentement retiré',
  suppressed: 'Liste d’opposition',
  cancelled: 'Campagne annulée',
};

export const CONNECTION_STATUS_BADGE: Record<string, string> = {
  connected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  disconnected: 'bg-slate-100 text-slate-500 border-slate-200',
  error: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const TEMPLATE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  archived: 'Archivée',
};

export const AUTOMATION_KIND_LABELS: Record<string, string> = {
  birthday_student: 'Anniversaires élèves',
  birthday_staff: 'Anniversaires personnel',
};
