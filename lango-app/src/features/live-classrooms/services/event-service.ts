// Idempotent ingestion of provider events into the normalized, append-only
// participant-events ledger.
//
//  - The webhook receiver records a receipt for EVERY delivery (verified or not)
//    so a forged signature is auditable (signatureResult=failed) and never
//    becomes an event.
//  - A verified event is inserted ONCE: unique (tenantId, providerEventId) makes
//    duplicate deliveries no-ops.
//  - Raw provider payloads are stored as bounded jsonb diagnostic evidence only.
import { and, eq, isNotNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  liveClassParticipantEvents, liveClassProviderProfiles, liveClassSessions,
  liveClassWebhookReceipts,
} from '@/models/Schema';
import { getProviderOrThrow, resolveWebhookSecretForProfile } from '@/features/live-classrooms/providers';

function syntheticEventId(body: unknown): string {
  const json = JSON.stringify(body);
  return `hash-${createHash('sha256').update(json).digest('hex').slice(0, 32)}`;
}

function mapExternalParticipant(providerType: string, externalParticipantId: string): string | null {
  if (externalParticipantId.startsWith('dev-user-')) {
    return externalParticipantId.slice('dev-user-'.length);
  }
  return null;
}

export type WebhookIngestResult = {
  signatureResult: string;
  duplicate: boolean;
  eventIngested: boolean;
  sessionFound: boolean;
};

export async function ingestWebhook(
  providerType: string,
  headers: Record<string, string | undefined>,
  body: unknown,
): Promise<WebhookIngestResult> {
  const provider = getProviderOrThrow(providerType);
  // normalizeWebhook only reads the body shape (no trust decision) — safe to
  // call before verification, and required to resolve WHICH session/profile
  // this delivery claims to be for.
  const normalized = provider.normalizeWebhook(body);

  // P1-4: resolve by provider_type + provider_meeting_id + tenant (the unique
  // (provider_profile_id, provider_meeting_id) index on sessions means this
  // can only ever match ONE profile) — the delivery is then verified against
  // THAT profile's own secret, never a global provider-wide one.
  const sessions = await db
    .select({
      id: liveClassSessions.id,
      tenantId: liveClassSessions.tenantId,
      providerProfileId: liveClassSessions.providerProfileId,
      webhookSecretRef: liveClassProviderProfiles.webhookSecretRef,
    })
    .from(liveClassSessions)
    .innerJoin(liveClassProviderProfiles, eq(liveClassSessions.providerProfileId, liveClassProviderProfiles.id))
    .where(and(
      eq(liveClassSessions.providerMeetingId, normalized.sessionExternalId),
      eq(liveClassProviderProfiles.providerType, providerType),
      eq(liveClassProviderProfiles.enabled, true),
      eq(liveClassProviderProfiles.tenantId, liveClassSessions.tenantId),
    ))
    .limit(2);
  if (sessions.length === 0) {
    return { signatureResult: 'unsigned', duplicate: false, eventIngested: false, sessionFound: false };
  }
  if (sessions.length !== 1) {
    throw new ApiError(409, 'AMBIGUOUS_PROVIDER_SESSION', 'La session fournisseur ne peut pas être résolue de façon unique.');
  }
  const session = sessions[0]!;

  const secretResult = resolveWebhookSecretForProfile({ webhookSecretRef: session.webhookSecretRef });
  // A production profile whose webhook secret fails to resolve (missing /
  // too short / known-insecure) must fail CLOSED: never fall back to
  // verifying with an empty/undefined secret, which would accept anything.
  const verification = secretResult.ok
    ? provider.verifyWebhook(headers, body, secretResult.secret)
    : { valid: false as const, reason: 'failed' as const };

  const providerEventId = normalized.providerEventId || syntheticEventId(body);

  // Transactional idempotent receipt: the INSERT itself (via the partial
  // unique index on (tenant_id, provider_event_id)) is the sole existence
  // check — no separate SELECT-then-INSERT race window — and the event
  // insert happens in the SAME transaction, so a receipt is never recorded
  // without its event (when valid) landing atomically alongside it.
  return db.transaction(async (tx) => {
    const [receiptRow] = await tx.insert(liveClassWebhookReceipts).values({
      tenantId: session.tenantId,
      providerProfileId: session.providerProfileId,
      providerEventId,
      signatureResult: verification.reason,
      processingStatus: verification.valid ? 'processed' : 'failed',
      rawPayload: body,
    })
      // Matches the partial unique index (tenantId, providerEventId) WHERE
      // providerEventId IS NOT NULL — the WHERE clause here must match it
      // exactly or Postgres cannot infer the arbiter index (42P10).
      .onConflictDoNothing({
        target: [liveClassWebhookReceipts.tenantId, liveClassWebhookReceipts.providerEventId],
        where: isNotNull(liveClassWebhookReceipts.providerEventId),
      })
      .returning({ id: liveClassWebhookReceipts.id });

    if (!receiptRow) {
      return { signatureResult: verification.reason, duplicate: true, eventIngested: false, sessionFound: true };
    }

    if (!verification.valid) {
      return { signatureResult: verification.reason, duplicate: false, eventIngested: false, sessionFound: true };
    }

    const userId = mapExternalParticipant(providerType, normalized.externalParticipantId);
    const [eventInserted] = await tx.insert(liveClassParticipantEvents)
      .values({
        tenantId: session.tenantId,
        sessionId: session.id,
        providerEventId,
        providerProfileId: session.providerProfileId,
        userId,
        externalParticipantId: normalized.externalParticipantId || null,
        participantRole: normalized.participantRole ?? null,
        eventType: normalized.type,
        providerTimestamp: normalized.timestamp,
        rawPayload: body,
        processingStatus: 'processed',
      })
      .onConflictDoNothing({ target: [liveClassParticipantEvents.tenantId, liveClassParticipantEvents.providerEventId] })
      .returning();

    await tx.update(liveClassSessions)
      .set({ lastSyncAt: new Date().toISOString() })
      .where(eq(liveClassSessions.id, session.id));

    return { signatureResult: verification.reason, duplicate: false, eventIngested: Boolean(eventInserted), sessionFound: true };
  });
}

export async function syncSessionEvents(tenantId: string, sessionId: string): Promise<{ inserted: number }> {
  const [session] = await db.select().from(liveClassSessions)
    .where(and(eq(liveClassSessions.id, sessionId), eq(liveClassSessions.tenantId, tenantId))).limit(1);
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');
  if (!session.providerMeetingId) return { inserted: 0 };

  const [profile] = await db.select().from(liveClassProviderProfiles)
    .where(and(eq(liveClassProviderProfiles.id, session.providerProfileId), eq(liveClassProviderProfiles.tenantId, tenantId))).limit(1);
  if (!profile) throw new ApiError(422, 'INVALID_REFERENCE', 'Profil fournisseur introuvable.');

  const provider = getProviderOrThrow(profile.providerType);
  const events = await provider.syncEvents(session.providerMeetingId, undefined, {
    baseUrl: profile.baseUrl,
    accountId: profile.accountId,
  });

  let inserted = 0;
  for (const ev of events) {
    const userId = mapExternalParticipant(profile.providerType, ev.externalParticipantId);
    const [row] = await db.insert(liveClassParticipantEvents)
      .values({
        tenantId,
        sessionId: session.id,
        providerEventId: ev.providerEventId || syntheticEventId(ev.raw),
        providerProfileId: session.providerProfileId,
        userId,
        externalParticipantId: ev.externalParticipantId || null,
        participantRole: ev.participantRole ?? null,
        eventType: ev.type,
        providerTimestamp: ev.timestamp,
        rawPayload: ev.raw,
        processingStatus: 'processed',
      })
      .onConflictDoNothing({ target: [liveClassParticipantEvents.tenantId, liveClassParticipantEvents.providerEventId] })
      .returning();
    if (row) inserted++;
  }

  await db.update(liveClassSessions)
    .set({ lastSyncAt: new Date().toISOString() })
    .where(eq(liveClassSessions.id, session.id));

  return { inserted };
}
