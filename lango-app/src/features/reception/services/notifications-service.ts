import type { RequestContext } from '@/libs/api/context';
import { sendSmsMessage } from '@/features/broadcast/services/sms-delivery';
import { requireTenant } from '@/libs/api/context';
// Approved-template notifications. Only a fixed set of French template keys may
// be sent; the body is rendered server-side from structured data, never from
// user free text, so the receptionist can never craft arbitrary bulk messages
// (receptionist-portal plan §8: "approuvé uniquement via gabarit").
//
// Delivery truth: the message goes through the shared `sendSmsMessage` path,
// which records `sent`/`sentAt` only on provider evidence and otherwise keeps
// the row queued/simulated. The previous direct insert wrote status 'sent'
// with no provider call — a fake success state on every appointment notice.
import { ApiError } from '@/libs/api/errors';

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
 * Send an approved-template message for the recipient through the shared
 * provider-aware path. Returns the recorded delivery outcome (queued when the
 * tenant has no real provider), or null when there is no recipient phone
 * (silent no-op, never an error).
 */
export async function sendApprovedNotification(
  context: RequestContext,
  input: {
    templateKey: string;
    recipientPhone: string | null | undefined;
    data: TemplateData;
    actorId: string;
  },
): Promise<{ id: string; body: string; recipientPhone: string; delivery: string } | null> {
  const tenantId = requireTenant(context);
  if (!input.recipientPhone) {
    return null;
  }
  if (!isApprovedTemplate(input.templateKey)) {
    throw new ApiError(422, 'TEMPLATE_NOT_ALLOWED', 'Ce gabarit de notification n\'est pas approuvé.');
  }
  const body = RECEPTION_NOTIFICATION_TEMPLATES[input.templateKey]!.render(input.data);
  const result = await sendSmsMessage(tenantId, {
    to: input.recipientPhone,
    body,
    createdById: input.actorId,
  });
  return { id: result.id, body, recipientPhone: input.recipientPhone, delivery: result.delivery };
}
