import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { communicationConsents, communicationSuppressions } from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';
import type { broadcastChannel, communicationRecipientKind } from '../models/broadcast-schema';

type Channel = (typeof broadcastChannel.enumValues)[number];
type RecipientKind = (typeof communicationRecipientKind.enumValues)[number];

export type ConsentDecision = {
  /** true when the recipient may be contacted on this channel. */
  allowed: boolean;
  reason: 'ok' | 'no_consent' | 'consent_revoked' | 'suppressed';
};

/**
 * Consent + suppression check, evaluated at snapshot time AND immediately before
 * dispatch. A channel-specific suppression wins over a global one (more precise).
 * Consent defaults to allowed unless explicitly revoked — the school has an
 * existing relationship with its own students/guardians (administrative comms).
 * A revoked consent (granted=false) or any suppression blocks delivery.
 */
export async function checkConsent(
  tenantId: string,
  recipientKind: RecipientKind,
  recipientId: string,
  channel: Channel,
): Promise<ConsentDecision> {
  const [consent] = await db
    .select({ granted: communicationConsents.granted })
    .from(communicationConsents)
    .where(and(
      eq(communicationConsents.tenantId, tenantId),
      eq(communicationConsents.recipientKind, recipientKind),
      eq(communicationConsents.recipientId, recipientId),
      eq(communicationConsents.channel, channel),
    ))
    .limit(1);
  if (consent && !consent.granted) return { allowed: false, reason: 'consent_revoked' };

  const suppressed = await db
    .select({ id: communicationSuppressions.id })
    .from(communicationSuppressions)
    .where(and(
      eq(communicationSuppressions.tenantId, tenantId),
      eq(communicationSuppressions.recipientKind, recipientKind),
      eq(communicationSuppressions.recipientId, recipientId),
    ))
    .limit(1);
  // Global (channel IS NULL) and channel-specific rows both block. The unique
  // partial indexes in migration 0079 keep at most one of each shape per
  // recipient; any hit means suppressed on this channel.
  if (suppressed.length > 0) return { allowed: false, reason: 'suppressed' };
  return { allowed: true, reason: 'ok' };
}

// ---------------------------------------------------------------------------
// Admin management (consent register + suppression list)
// ---------------------------------------------------------------------------

export async function listConsents(tenantId: string) {
  const rows = await db
    .select()
    .from(communicationConsents)
    .where(eq(communicationConsents.tenantId, tenantId))
    .orderBy(communicationConsents.updatedAt);
  return rows.map((c) => ({
    id: c.id,
    recipientKind: c.recipientKind,
    recipientId: c.recipientId,
    channel: c.channel,
    granted: c.granted,
    source: c.source,
    capturedAt: c.capturedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

/** Upsert a consent decision; idempotent per (tenant, kind, recipient, channel). */
export async function setConsent(
  tenantId: string,
  body: { recipientKind: RecipientKind; recipientId: string; channel: Channel; granted: boolean; source?: string },
) {
  if (!body.recipientId?.trim()) throw new ApiError(422, 'VALIDATION_ERROR', 'Le destinataire est requis.');
  await db
    .insert(communicationConsents)
    .values({
      tenantId,
      recipientKind: body.recipientKind,
      recipientId: body.recipientId.trim(),
      channel: body.channel,
      granted: body.granted,
      source: body.source ?? 'admin',
    })
    .onConflictDoUpdate({
      target: [communicationConsents.tenantId, communicationConsents.recipientKind, communicationConsents.recipientId, communicationConsents.channel],
      set: { granted: body.granted, source: body.source ?? 'admin', updatedAt: new Date().toISOString() },
    });
  return { ok: true };
}

export async function listSuppressions(tenantId: string) {
  const rows = await db
    .select()
    .from(communicationSuppressions)
    .where(eq(communicationSuppressions.tenantId, tenantId))
    .orderBy(communicationSuppressions.createdAt);
  return rows.map((s) => ({
    id: s.id,
    recipientKind: s.recipientKind,
    recipientId: s.recipientId,
    channel: s.channel,
    reason: s.reason,
    createdAt: s.createdAt,
  }));
}

/** Add a suppression (global when channel is null). Idempotent per the partial unique indexes. */
export async function addSuppression(
  tenantId: string,
  body: { recipientKind: RecipientKind; recipientId: string; channel?: Channel | null; reason?: string | null },
  actorId: string | null,
) {
  if (!body.recipientId?.trim()) throw new ApiError(422, 'VALIDATION_ERROR', 'Le destinataire est requis.');
  await db
    .insert(communicationSuppressions)
    .values({
      tenantId,
      recipientKind: body.recipientKind,
      recipientId: body.recipientId.trim(),
      channel: body.channel ?? null,
      reason: body.reason ?? null,
      createdBy: actorId,
    })
    .onConflictDoNothing();
  return { ok: true };
}

export async function removeSuppression(tenantId: string, suppressionId: string) {
  const [deleted] = await db
    .delete(communicationSuppressions)
    .where(and(eq(communicationSuppressions.id, suppressionId), eq(communicationSuppressions.tenantId, tenantId)))
    .returning({ id: communicationSuppressions.id });
  if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Suppression introuvable.');
}
