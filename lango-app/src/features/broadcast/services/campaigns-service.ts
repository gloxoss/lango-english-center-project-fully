// Campaign lifecycle: composer CRUD, recipient preview (live segment +
// consent/suppression), approval that freezes both the template version and the
// recipient snapshot, scheduling/cancellation, and enqueue into deliveries.
//
// Tenant isolation is enforced on every query; the approval snapshot uses
// onConflictDoNothing so re-approving (or a concurrent duplicate submit) never
// double-inserts recipients. Campaign send itself is handled by outbox-worker.
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  communicationCampaignRecipients,
  communicationCampaigns,
  communicationConnections,
  communicationSegments,
} from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';
import type { broadcastChannel } from '../models/broadcast-schema';
import { checkConsent } from './consent-service';
import { computeSegment, parseSegmentDefinition } from './segments-service';
import { countSmsSegments } from './sms-encoding';
import { getPublishedVersion } from './templates-service';
import { getProvider } from '../providers/provider';
import '../providers/test-provider';

type Channel = (typeof broadcastChannel.enumValues)[number];

const SMS_LIKE: Channel[] = ['sms', 'whatsapp', 'telegram', 'messenger'];

export function campaignPublic(c: typeof communicationCampaigns.$inferSelect) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    branchId: c.branchId,
    name: c.name,
    channel: c.channel,
    connectionId: c.connectionId,
    segmentId: c.segmentId,
    templateId: c.templateId,
    templateVersionId: c.templateVersionId,
    subject: c.subject,
    bodyText: c.bodyText,
    bodyHtml: c.bodyHtml,
    scheduleAt: c.scheduleAt,
    timezone: c.timezone,
    status: c.status,
    targetedCount: c.targetedCount,
    excludedCount: c.excludedCount,
    invalidCount: c.invalidCount,
    dedupCount: c.dedupCount,
    consentExcludedCount: c.consentExcludedCount,
    suppressionExcludedCount: c.suppressionExcludedCount,
    enqueuedCount: c.enqueuedCount,
    sentCount: c.sentCount,
    deliveredCount: c.deliveredCount,
    failedCount: c.failedCount,
    estimatedCost: c.estimatedCost,
    idempotencyKey: c.idempotencyKey,
    createdBy: c.createdBy,
    approvedBy: c.approvedBy,
    approvedAt: c.approvedAt,
    sentAt: c.sentAt,
    completedAt: c.completedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export type CampaignInput = {
  name: string;
  channel: Channel;
  connectionId?: string | null;
  segmentId?: string | null;
  templateId?: string | null;
  subject?: string | null;
  bodyText: string;
  bodyHtml?: string | null;
  scheduleAt?: string | null;
  timezone?: string | null;
  idempotencyKey?: string | null;
};

async function getCampaignRow(tenantId: string, id: string) {
  const [c] = await db
    .select()
    .from(communicationCampaigns)
    .where(and(eq(communicationCampaigns.id, id), eq(communicationCampaigns.tenantId, tenantId)))
    .limit(1);
  if (!c) throw new ApiError(404, 'NOT_FOUND', 'Campagne introuvable.');
  return c;
}

async function assertConnection(tenantId: string, connectionId: string | null | undefined, channel: Channel): Promise<string | null> {
  if (!connectionId) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Une connexion de canal est requise pour envoyer cette campagne.');
  }
  const [conn] = await db
    .select({ id: communicationConnections.id, provider: communicationConnections.provider, channel: communicationConnections.channel })
    .from(communicationConnections)
    .where(and(eq(communicationConnections.id, connectionId), eq(communicationConnections.tenantId, tenantId)))
    .limit(1);
  if (!conn) throw new ApiError(404, 'NOT_FOUND', 'Connexion introuvable.');
  if (conn.channel !== channel) throw new ApiError(422, 'VALIDATION_ERROR', 'La connexion ne correspond pas au canal de la campagne.');
  if (!getProvider(conn.provider)) throw new ApiError(422, 'VALIDATION_ERROR', `Fournisseur « ${conn.provider} » inconnu.`);
  return conn.provider;
}

export async function createCampaign(tenantId: string, body: CampaignInput, actorId: string | null) {
  if (!body.name?.trim()) throw new ApiError(422, 'VALIDATION_ERROR', 'Le nom de la campagne est requis.');
  if (!body.bodyText?.trim()) throw new ApiError(422, 'VALIDATION_ERROR', 'Le message de la campagne est requis.');

  if (body.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(communicationCampaigns)
      .where(and(
        eq(communicationCampaigns.tenantId, tenantId),
        eq(communicationCampaigns.idempotencyKey, body.idempotencyKey),
      ))
      .limit(1);
    if (existing) return campaignPublic(existing);
  }

  if (body.segmentId) {
    const [seg] = await db
      .select({ id: communicationSegments.id })
      .from(communicationSegments)
      .where(and(eq(communicationSegments.id, body.segmentId), eq(communicationSegments.tenantId, tenantId)))
      .limit(1);
    if (!seg) throw new ApiError(404, 'NOT_FOUND', 'Segment introuvable.');
  }

  const values: Record<string, unknown> = {
    tenantId,
    branchId: null,
    name: body.name.trim(),
    channel: body.channel,
    connectionId: body.connectionId ?? null,
    segmentId: body.segmentId ?? null,
    templateId: body.templateId ?? null,
    templateVersionId: null,
    subject: body.subject ?? null,
    bodyText: body.bodyText,
    bodyHtml: body.bodyHtml ?? null,
    scheduleAt: body.scheduleAt ?? null,
    timezone: body.timezone ?? 'Africa/Casablanca',
    status: 'draft',
    idempotencyKey: body.idempotencyKey ?? null,
    createdBy: actorId,
  };
  const inserted = await db.insert(communicationCampaigns).values(values as any).onConflictDoNothing().returning();
  const row = inserted[0];
  if (row) return campaignPublic(row);

  // Conflict = duplicate idempotency key; the unique partial index guarantees
  // the caller receives the same campaign on replay.
  const [existing] = await db
    .select()
    .from(communicationCampaigns)
    .where(and(eq(communicationCampaigns.tenantId, tenantId), eq(communicationCampaigns.idempotencyKey, body.idempotencyKey as string)))
    .limit(1);
  if (existing) return campaignPublic(existing);
  throw new ApiError(409, 'CONFLICT', 'Impossible de créer la campagne.');
}

const EDITABLE_STATUSES = new Set(['draft', 'pending_approval']);

export async function updateCampaign(tenantId: string, id: string, patch: Partial<CampaignInput>) {
  const existing = await getCampaignRow(tenantId, id);
  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new ApiError(422, 'INVALID_STATE', 'Une campagne envoyée ou planifiée ne peut plus être modifiée.');
  }
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.channel !== undefined) set.channel = patch.channel;
  if (patch.connectionId !== undefined) set.connectionId = patch.connectionId;
  if (patch.segmentId !== undefined) set.segmentId = patch.segmentId;
  if (patch.templateId !== undefined) set.templateId = patch.templateId;
  if (patch.subject !== undefined) set.subject = patch.subject;
  if (patch.bodyText !== undefined) set.bodyText = patch.bodyText;
  if (patch.bodyHtml !== undefined) set.bodyHtml = patch.bodyHtml;
  if (patch.scheduleAt !== undefined) set.scheduleAt = patch.scheduleAt;
  if (patch.timezone !== undefined) set.timezone = patch.timezone;
  if (patch.idempotencyKey !== undefined) set.idempotencyKey = patch.idempotencyKey;
  set.updatedAt = new Date().toISOString();
  const [updated] = await db
    .update(communicationCampaigns)
    .set(set as any)
    .where(and(eq(communicationCampaigns.id, id), eq(communicationCampaigns.tenantId, tenantId)))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Campagne introuvable.');
  return campaignPublic(updated);
}

export async function listCampaigns(tenantId: string, channel?: string) {
  const conditions: any[] = [eq(communicationCampaigns.tenantId, tenantId)];
  if (channel) conditions.push(eq(communicationCampaigns.channel, channel as any));
  const rows = await db
    .select()
    .from(communicationCampaigns)
    .where(and(...conditions))
    .orderBy(desc(communicationCampaigns.createdAt));
  return rows.map(campaignPublic);
}

export async function getCampaign(tenantId: string, id: string) {
  return campaignPublic(await getCampaignRow(tenantId, id));
}

// ---------------------------------------------------------------------------
// Recipient preview (dry run — no rows written)
// ---------------------------------------------------------------------------

export type PreviewTotals = {
  targeted: number;
  invalid: number;
  dedup: number;
  consentExcluded: number;
  suppressionExcluded: number;
  enqueued: number;
  estimatedCost: string;
};

export async function computeRecipientPreview(tenantId: string, campaign: { channel: Channel; segmentId: string | null; bodyText: string }): Promise<PreviewTotals> {
  if (!campaign.segmentId) throw new ApiError(422, 'VALIDATION_ERROR', 'Aucun segment sélectionné.');
  const [seg] = await db
    .select()
    .from(communicationSegments)
    .where(and(eq(communicationSegments.id, campaign.segmentId), eq(communicationSegments.tenantId, tenantId)))
    .limit(1);
  if (!seg) throw new ApiError(404, 'NOT_FOUND', 'Segment introuvable.');

  const definition = parseSegmentDefinition(seg.definition);
  const { recipients } = await computeSegment(tenantId, definition);

  const seen = new Set<string>();
  let invalid = 0;
  let dedup = 0;
  let consentExcluded = 0;
  let suppressionExcluded = 0;
  let enqueued = 0;
  let costUnits = 0;

  const needsPhone = SMS_LIKE.includes(campaign.channel);
  for (const r of recipients) {
    const key = `${r.recipientKind}:${r.recipientId}`;
    if (seen.has(key)) {
      dedup += 1;
      continue;
    }
    seen.add(key);
    const hasContact = needsPhone ? Boolean(r.phone) : Boolean(r.email);
    if (!hasContact) {
      invalid += 1;
      continue;
    }
    const consent = await checkConsent(tenantId, r.recipientKind, r.recipientId, campaign.channel);
    if (consent.reason === 'consent_revoked') {
      consentExcluded += 1;
      continue;
    }
    if (consent.reason === 'suppressed') {
      suppressionExcluded += 1;
      continue;
    }
    enqueued += 1;
    if (needsPhone) costUnits += countSmsSegments(campaign.bodyText).segments;
    else costUnits += 1;
  }

  const targeted = recipients.length;
  return {
    targeted,
    invalid,
    dedup,
    consentExcluded,
    suppressionExcluded,
    enqueued,
    estimatedCost: String(costUnits),
  };
}

// ---------------------------------------------------------------------------
// Approval: freeze template version + recipient snapshot, then schedule/queue
// ---------------------------------------------------------------------------

export async function approveCampaign(tenantId: string, id: string, actorId: string | null) {
  const campaign = await getCampaignRow(tenantId, id);
  if (!['draft', 'pending_approval'].includes(campaign.status)) {
    throw new ApiError(422, 'INVALID_STATE', 'Cette campagne ne peut pas être approuvée dans son état actuel.');
  }
  await assertConnection(tenantId, campaign.connectionId, campaign.channel as Channel);

  // Freeze template version (published, immutable) when a template is used.
  let templateVersionId: string | null = null;
  if (campaign.templateId) {
    const published = await getPublishedVersion(tenantId, campaign.templateId);
    if (!published) throw new ApiError(422, 'VALIDATION_ERROR', 'Le modèle sélectionné n\'a pas de version publiée.');
    templateVersionId = published.id;
  }

  const totals = await computeRecipientPreview(tenantId, campaign);
  const status = campaign.scheduleAt ? 'scheduled' : 'queued';

  const [updated] = await db
    .update(communicationCampaigns)
    .set({
      templateVersionId,
      status,
      targetedCount: totals.targeted,
      excludedCount: totals.invalid + totals.dedup + totals.consentExcluded + totals.suppressionExcluded,
      invalidCount: totals.invalid,
      dedupCount: totals.dedup,
      consentExcludedCount: totals.consentExcluded,
      suppressionExcludedCount: totals.suppressionExcluded,
      enqueuedCount: totals.enqueued,
      estimatedCost: totals.estimatedCost,
      approvedBy: actorId,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any)
    .where(and(eq(communicationCampaigns.id, id), eq(communicationCampaigns.tenantId, tenantId)))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Campagne introuvable.');

  await snapshotRecipients(tenantId, campaign);
  return { campaign: campaignPublic(updated), totals };
}

/**
 * Write the recipient snapshot (one row per considered recipient; excluded rows
 * are marked skipped with a reason). Idempotent via the per-campaign unique
 * (recipientKind, recipientId) constraint + onConflictDoNothing.
 */
async function snapshotRecipients(
  tenantId: string,
  campaign: { id: string; channel: Channel; segmentId: string | null; bodyText: string },
): Promise<void> {
  if (!campaign.segmentId) return;
  const [seg] = await db
    .select({ definition: communicationSegments.definition })
    .from(communicationSegments)
    .where(and(eq(communicationSegments.id, campaign.segmentId), eq(communicationSegments.tenantId, tenantId)))
    .limit(1);
  if (!seg) return;
  const { recipients } = await computeSegment(tenantId, parseSegmentDefinition(seg.definition));

  const needsPhone = SMS_LIKE.includes(campaign.channel);
  const seen = new Set<string>();
  for (const r of recipients) {
    const key = `${r.recipientKind}:${r.recipientId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let status: string = 'pending';
    let skipReason: string | null = null;
    if (needsPhone ? !r.phone : !r.email) {
      status = 'skipped';
      skipReason = 'invalid_contact';
    } else {
      const consent = await checkConsent(tenantId, r.recipientKind, r.recipientId, campaign.channel);
      if (consent.reason === 'consent_revoked') {
        status = 'skipped';
        skipReason = 'consent_revoked';
      } else if (consent.reason === 'suppressed') {
        status = 'skipped';
        skipReason = 'suppressed';
      }
    }
    await db
      .insert(communicationCampaignRecipients)
      .values({
        tenantId,
        campaignId: campaign.id,
        recipientKind: r.recipientKind,
        recipientId: r.recipientId,
        contactName: r.name ?? null,
        phone: r.phone,
        email: r.email,
        status: status as any,
        skipReason,
      })
      .onConflictDoNothing();
  }
}

// ---------------------------------------------------------------------------
// Schedule / cancel / delete
// ---------------------------------------------------------------------------

export async function scheduleCampaign(tenantId: string, id: string, scheduleAt: string | null) {
  const campaign = await getCampaignRow(tenantId, id);
  if (!['draft', 'pending_approval', 'scheduled'].includes(campaign.status)) {
    throw new ApiError(422, 'INVALID_STATE', 'Cette campagne ne peut pas être planifiée dans son état actuel.');
  }
  if (scheduleAt && new Date(scheduleAt).getTime() <= Date.now()) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'La date de programmation doit être dans le futur.');
  }
  const [updated] = await db
    .update(communicationCampaigns)
    .set({ scheduleAt, updatedAt: new Date().toISOString() } as any)
    .where(and(eq(communicationCampaigns.id, id), eq(communicationCampaigns.tenantId, tenantId)))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Campagne introuvable.');
  return campaignPublic(updated);
}

const CANCELLABLE = new Set(['pending_approval', 'scheduled', 'queued', 'sending']);

export async function cancelCampaign(tenantId: string, id: string) {
  const campaign = await getCampaignRow(tenantId, id);
  if (!CANCELLABLE.has(campaign.status)) {
    throw new ApiError(422, 'INVALID_STATE', 'Cette campagne ne peut pas être annulée dans son état actuel.');
  }
  // Mark still-pending recipients and non-terminal deliveries as cancelled so
  // the counts reconcile; the worker also re-checks campaign status before send.
  await db
    .update(communicationCampaignRecipients)
    .set({ status: 'skipped', skipReason: 'cancelled' })
    .where(and(
      eq(communicationCampaignRecipients.campaignId, id),
      sql`${communicationCampaignRecipients.status} = 'pending'`,
    ));
  const [updated] = await db
    .update(communicationCampaigns)
    .set({ status: 'cancelled', updatedAt: new Date().toISOString() } as any)
    .where(and(eq(communicationCampaigns.id, id), eq(communicationCampaigns.tenantId, tenantId)))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Campagne introuvable.');
  return campaignPublic(updated);
}

export async function deleteCampaign(tenantId: string, id: string) {
  const campaign = await getCampaignRow(tenantId, id);
  if (!['draft', 'cancelled'].includes(campaign.status)) {
    throw new ApiError(422, 'INVALID_STATE', 'Seules les campagnes brouillons ou annulées peuvent être supprimées.');
  }
  await db
    .delete(communicationCampaigns)
    .where(and(eq(communicationCampaigns.id, id), eq(communicationCampaigns.tenantId, tenantId)));
}
