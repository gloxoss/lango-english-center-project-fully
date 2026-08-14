// Approved-template notifications. Only a fixed set of French template keys may
// be sent; the body is rendered server-side from structured data, never from
// user free text. Sent through the log-only SMS channel (smsMessages, status
// 'sent'), so the receptionist can never craft arbitrary bulk messages
// (receptionist-portal plan §8: "approuvé uniquement via gabarit").
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { smsMessages } from '@/models/Schema';

type TemplateData = {
  date?: string;
  time?: string;
  purpose?: string;
  school?: string;
  handoffTitle?: string;
  priority?: string;
};

type Template = {
  render: (data: TemplateData) => string;
};

// The allowlist — adding a key here is a code change + security review, never
// a runtime string. Bodies are built from structured fields only.
export const RECEPTION_NOTIFICATION_TEMPLATES: Record<string, Template> = {
  appointment_scheduled: {
    render: ({ date, time, purpose, school }) =>
      `Rendez-vous confirmé le ${date ?? ''} à ${time ?? ''} (motif : ${purpose ?? ''}). ${school ?? ''}`.trim(),
  },
  appointment_reminder: {
    render: ({ date, time, purpose }) =>
      `Rappel : rendez-vous le ${date ?? ''} à ${time ?? ''} (motif : ${purpose ?? ''}).`.trim(),
  },
  appointment_cancelled: {
    render: ({ date, purpose }) =>
      `Votre rendez-vous du ${date ?? ''} (motif : ${purpose ?? ''}) a été annulé.`.trim(),
  },
  handoff_assigned: {
    render: ({ handoffTitle, priority }) =>
      `Tâche transmise : ${handoffTitle ?? ''} (priorité ${priority ?? 'medium'}).`.trim(),
  },
};

export function isApprovedTemplate(key: string): key is keyof typeof RECEPTION_NOTIFICATION_TEMPLATES {
  return key in RECEPTION_NOTIFICATION_TEMPLATES;
}

/**
 * Log an approved-template SMS for the recipient. Log-only: no external
 * provider, status written 'sent' immediately. Returns null when there is no
 * recipient phone (silent no-op, never an error).
 */
export async function sendApprovedNotification(
  context: RequestContext,
  input: {
    templateKey: string;
    recipientPhone: string | null | undefined;
    data: TemplateData;
    actorId: string;
  },
): Promise<{ id: string; body: string; recipientPhone: string } | null> {
  const tenantId = requireTenant(context);
  if (!input.recipientPhone) return null;
  if (!isApprovedTemplate(input.templateKey)) {
    throw new ApiError(422, 'TEMPLATE_NOT_ALLOWED', 'Ce gabarit de notification n\'est pas approuvé.');
  }
  const body = RECEPTION_NOTIFICATION_TEMPLATES[input.templateKey]!.render(input.data);
  const now = new Date().toISOString();
  const [row] = await db
    .insert(smsMessages)
    .values({
      tenantId,
      recipientPhone: input.recipientPhone,
      body,
      status: 'sent',
      sentAt: now,
      createdById: input.actorId,
    })
    .returning({ id: smsMessages.id, body: smsMessages.body, recipientPhone: smsMessages.recipientPhone });
  if (!row) return null;
  return { id: row.id, body: row.body, recipientPhone: row.recipientPhone };
}
