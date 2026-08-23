// Outbox worker: claims due work with FOR UPDATE SKIP LOCKED (no double-send
// under concurrency), enqueues deliveries from approved snapshots, calls the
// provider adapter, and appends to the immutable delivery_events log.
//
// Consent/suppression is re-checked immediately before dispatch — a recipient
// who revoked or suppressed between approval and send time is skipped. Real
// carriers are never called; providers are log/test adapters (honesty
// convention), and `delivered` only ever comes from provider evidence.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  communicationAutomationRecipients,
  communicationAutomationRuns,
  communicationAutomations,
  communicationCampaignRecipients,
  communicationCampaigns,
  communicationConnections,
  communicationDeliveries,
  communicationDeliveryEvents,
  user,
} from '@/models/Schema';
import type { broadcastChannel } from '../models/broadcast-schema';
import { getConnectionWithSecrets } from './connections-service';
import { checkConsent } from './consent-service';
import { STAFF_ROLES } from './segments-service';
import { getPublishedVersion, renderVersion } from './templates-service';
import { getProvider } from '../providers/provider';
import '../providers';

type Channel = (typeof broadcastChannel.enumValues)[number];
const SMS_LIKE: Channel[] = ['sms', 'whatsapp', 'telegram', 'messenger'];

const LOCK_WINDOW_MS = 5 * 60 * 1000; // claim lease; expires if the worker dies
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000;
const LOCK_LEASE = sql`now() + interval '5 minutes'`;

export type WorkerSummary = {
  promotedCampaigns: number;
  claimedCampaigns: number;
  createdDeliveries: number;
  claimedDeliveries: number;
  sent: number;
  delivered: number;
  failed: number;
  retried: number;
  automationSent: number;
  automationFailed: number;
};

// ---------------------------------------------------------------------------
// Campaign promotion: scheduled → queued → sending
// ---------------------------------------------------------------------------

async function promoteScheduled(tenantId: string): Promise<number> {
  const res = await db.execute(sql`
    UPDATE communication_campaigns
    SET status = 'queued', updated_at = now()
    WHERE tenant_id = ${tenantId}
      AND status = 'scheduled'
      AND schedule_at IS NOT NULL
      AND schedule_at <= now()
    RETURNING id
  `);
  return res.rowCount ?? 0;
}

/** Claim one queued campaign atomically and create its deliveries. */
async function claimAndEnqueueCampaign(tenantId: string): Promise<number> {
  const rows = await db.transaction(async (tx) => {
    const claimed = await tx.execute(sql`
      WITH claimed AS (
        SELECT c.id
        FROM communication_campaigns c
        WHERE c.tenant_id = ${tenantId}
          AND c.status = 'queued'
        ORDER BY c.created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE communication_campaigns c
      SET status = 'sending', updated_at = now()
      FROM claimed
      WHERE c.id = claimed.id
      RETURNING c.id
    `);
    const campaignId = (claimed.rows[0] as { id?: string } | undefined)?.id;
    if (!campaignId) return 0;
    return await enqueueCampaignDeliveries(tx as any, tenantId, campaignId);
  });
  return rows;
}

async function enqueueCampaignDeliveries(tx: any, tenantId: string, campaignId: string): Promise<number> {
  const [campaign] = await tx
    .select()
    .from(communicationCampaigns)
    .where(and(eq(communicationCampaigns.id, campaignId), eq(communicationCampaigns.tenantId, tenantId)))
    .limit(1);
  if (!campaign) return 0;

  const [conn] = await tx
    .select({ provider: communicationConnections.provider })
    .from(communicationConnections)
    .where(and(eq(communicationConnections.id, campaign.connectionId!), eq(communicationConnections.tenantId, tenantId)))
    .limit(1);
  const providerName = conn?.provider ?? 'test';

  const recipients = await tx
    .select()
    .from(communicationCampaignRecipients)
    .where(and(
      eq(communicationCampaignRecipients.campaignId, campaignId),
      eq(communicationCampaignRecipients.tenantId, tenantId),
      eq(communicationCampaignRecipients.status, 'pending'),
    ));

  const needsPhone = SMS_LIKE.includes(campaign.channel as Channel);
  let created = 0;
  for (const r of recipients) {
    const to = needsPhone ? r.phone : r.email;
    if (!to) {
      await tx
        .update(communicationCampaignRecipients)
        .set({ status: 'skipped', skipReason: 'invalid_contact' })
        .where(eq(communicationCampaignRecipients.id, r.id));
      continue;
    }
    const inserted = await tx
      .insert(communicationDeliveries)
      .values({
        tenantId,
        campaignId,
        recipientId: r.id,
        channel: campaign.channel,
        provider: providerName,
        status: 'queued',
        maxRetries: 3,
        idempotencyKey: `delivery:${campaignId}:${r.id}`,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 1) {
      created += 1;
      await tx
        .update(communicationCampaignRecipients)
        .set({ status: 'queued' })
        .where(eq(communicationCampaignRecipients.id, r.id));
    }
  }
  await tx
    .update(communicationCampaigns)
    .set({ enqueuedCount: created, updatedAt: new Date().toISOString() })
    .where(eq(communicationCampaigns.id, campaignId));

  // All recipients skipped at approval (e.g. every contact invalid or
  // suppressed) — close the campaign out immediately rather than leaving it
  // stuck in 'sending' with nothing to dispatch.
  const [dcount] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(communicationDeliveries)
    .where(eq(communicationDeliveries.campaignId, campaignId));
  if ((dcount?.n ?? 0) === 0) {
    await tx
      .update(communicationCampaigns)
      .set({ status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(communicationCampaigns.id, campaignId));
  }
  return created;
}

// ---------------------------------------------------------------------------
// Delivery claim + processing
// ---------------------------------------------------------------------------

async function claimDueDeliveries(tenantId: string, batch: number): Promise<string[]> {
  const res = await db.transaction(async (tx) => {
    const claimed = await tx.execute(sql`
      WITH claimed AS (
        SELECT d.id
        FROM communication_deliveries d
        WHERE d.tenant_id = ${tenantId}
          AND d.status = 'queued'
          AND (d.locked_until IS NULL OR d.locked_until <= now())
          AND (d.next_retry_at IS NULL OR d.next_retry_at <= now())
        ORDER BY d.created_at
        LIMIT ${batch}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE communication_deliveries d
      SET locked_until = ${LOCK_LEASE}
      FROM claimed
      WHERE d.id = claimed.id
      RETURNING d.id
    `);
    return (claimed.rows as { id: string }[]).map((r) => r.id);
  });
  return res;
}

async function processDelivery(tenantId: string, deliveryId: string): Promise<'sent' | 'delivered' | 'failed' | 'retried' | 'skipped'> {
  const [delivery] = await db
    .select()
    .from(communicationDeliveries)
    .where(and(eq(communicationDeliveries.id, deliveryId), eq(communicationDeliveries.tenantId, tenantId)))
    .limit(1);
  if (!delivery) return 'skipped';

  const [recipient] = await db
    .select()
    .from(communicationCampaignRecipients)
    .where(eq(communicationCampaignRecipients.id, delivery.recipientId))
    .limit(1);
  const [campaign] = await db
    .select()
    .from(communicationCampaigns)
    .where(eq(communicationCampaigns.id, delivery.campaignId))
    .limit(1);

  const markRecipient = (status: string, reason: string | null) =>
    db
      .update(communicationCampaignRecipients)
      .set({ status: status as any, skipReason: reason })
      .where(eq(communicationCampaignRecipients.id, delivery.recipientId));

  // Cancelled while in flight — do not send.
  if (campaign?.status === 'cancelled') {
    await db.update(communicationDeliveries).set({ status: 'failed', failureReason: 'cancelled', failedAt: new Date().toISOString(), lockedUntil: null }).where(eq(communicationDeliveries.id, deliveryId));
    await markRecipient('skipped', 'cancelled');
    await appendEvent(tenantId, deliveryId, delivery.campaignId, 'failed', 'cancelled');
    await refreshCampaignCounters(tenantId, delivery.campaignId);
    return 'skipped';
  }

  // Consent/suppression re-check immediately before dispatch.
  if (recipient) {
    const consent = await checkConsent(tenantId, recipient.recipientKind, recipient.recipientId, delivery.channel as Channel);
    if (consent.reason !== 'ok') {
      await db.update(communicationDeliveries).set({ status: 'failed', failureReason: consent.reason, failedAt: new Date().toISOString(), lockedUntil: null }).where(eq(communicationDeliveries.id, deliveryId));
      await markRecipient('skipped', consent.reason);
      await appendEvent(tenantId, deliveryId, delivery.campaignId, 'failed', consent.reason);
      await refreshCampaignCounters(tenantId, delivery.campaignId);
      return 'skipped';
    }
  }

  const connection = campaign?.connectionId ? await getConnectionWithSecrets(tenantId, campaign.connectionId) : null;
  const provider = getProvider(delivery.provider);
  if (!provider) {
    await db.update(communicationDeliveries).set({ status: 'failed', failureReason: 'unknown_provider', failedAt: new Date().toISOString(), lockedUntil: null }).where(eq(communicationDeliveries.id, deliveryId));
    await markRecipient('failed', 'unknown_provider');
    await appendEvent(tenantId, deliveryId, delivery.campaignId, 'failed', 'unknown_provider');
    await refreshCampaignCounters(tenantId, delivery.campaignId);
    return 'failed';
  }

  const needsPhone = SMS_LIKE.includes(delivery.channel as Channel);
  const to = needsPhone ? recipient?.phone : recipient?.email;
  if (!to) {
    await db.update(communicationDeliveries).set({ status: 'failed', failureReason: 'invalid_contact', failedAt: new Date().toISOString(), lockedUntil: null }).where(eq(communicationDeliveries.id, deliveryId));
    await markRecipient('skipped', 'invalid_contact');
    await appendEvent(tenantId, deliveryId, delivery.campaignId, 'failed', 'invalid_contact');
    await refreshCampaignCounters(tenantId, delivery.campaignId);
    return 'failed';
  }

  const result = await provider.send({
    channel: delivery.channel as Channel,
    to,
    subject: campaign?.subject,
    bodyText: campaign?.bodyText ?? '',
    bodyHtml: campaign?.bodyHtml,
    ...(connection?.configJson ? { config: connection.configJson as Record<string, unknown> } : {}),
  });

  const now = new Date().toISOString();
  if (result.ok) {
    await db
      .update(communicationDeliveries)
      .set({
        status: result.status,
        providerRef: result.providerRef ?? null,
        lockedUntil: null,
        nextRetryAt: null,
        sentAt: now,
        ...(result.status === 'delivered' ? { deliveredAt: now } : {}),
      })
      .where(eq(communicationDeliveries.id, deliveryId));
    await markRecipient('sent', null);
    await appendEvent(tenantId, deliveryId, delivery.campaignId, result.status === 'delivered' ? 'delivered' : 'sent', result.status);
    await refreshCampaignCounters(tenantId, delivery.campaignId);
    return result.status;
  }

  const retryable = result.retryable && delivery.retryCount < delivery.maxRetries;
  if (retryable) {
    const retryCount = delivery.retryCount + 1;
    const baseDelay = Math.min(2 ** retryCount * 60 * 1000, MAX_RETRY_DELAY_MS);
    const jitter = Math.floor(Math.random() * 30_000);
    const nextRetryAt = new Date(Date.now() + baseDelay + jitter).toISOString();
    await db
      .update(communicationDeliveries)
      .set({
        status: 'queued',
        retryCount,
        failureReason: result.failureReason ?? null,
        nextRetryAt,
        lockedUntil: null,
      })
      .where(eq(communicationDeliveries.id, deliveryId));
    await appendEvent(tenantId, deliveryId, delivery.campaignId, 'retry', `retry_${retryCount}`);
    return 'retried';
  }

  await db
    .update(communicationDeliveries)
    .set({
      status: result.status === 'bounced' ? 'bounced' : 'failed',
      failureReason: result.failureReason ?? 'provider_failure',
      failedAt: now,
      lockedUntil: null,
      nextRetryAt: null,
    })
    .where(eq(communicationDeliveries.id, deliveryId));
  await markRecipient('failed', result.failureReason ?? null);
  await appendEvent(tenantId, deliveryId, delivery.campaignId, result.status === 'bounced' ? 'bounced' : 'failed', result.status);
  await refreshCampaignCounters(tenantId, delivery.campaignId);
  return result.status === 'bounced' ? 'failed' : 'failed';
}

function appendEvent(tenantId: string, deliveryId: string, campaignId: string, eventType: string, status: string) {
  return db
    .insert(communicationDeliveryEvents)
    .values({
      tenantId,
      deliveryId,
      campaignId: campaignId ?? null,
      eventType: eventType as any,
      status,
      detail: { providerStatus: status },
    })
    .catch((err) => console.error('appendDeliveryEvent failed', { deliveryId, err }));
}

async function refreshCampaignCounters(tenantId: string, campaignId: string): Promise<void> {
  const counts = await db
    .select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where status in ('sent','delivered'))::int`,
      delivered: sql<number>`count(*) filter (where status = 'delivered')::int`,
      failed: sql<number>`count(*) filter (where status in ('failed','bounced'))::int`,
    })
    .from(communicationDeliveries)
    .where(eq(communicationDeliveries.campaignId, campaignId));
  const c = counts[0];
  if (!c) return;
  const terminal = c.sent + c.failed;
  const allTerminal = terminal >= c.total;
  const status = allTerminal
    ? (c.sent > 0 ? 'completed' : c.failed > 0 ? 'failed' : 'completed')
    : 'sending';
  await db
    .update(communicationCampaigns)
    .set({
      sentCount: c.sent,
      deliveredCount: c.delivered,
      failedCount: c.failed,
      status: status as any,
      ...(allTerminal ? { completedAt: new Date().toISOString() } : {}),
    })
    .where(and(eq(communicationCampaigns.id, campaignId), eq(communicationCampaigns.tenantId, tenantId)));
}

// ---------------------------------------------------------------------------
// Automation dispatch (birthday wishes): claim → resolve person → send
// ---------------------------------------------------------------------------

async function claimDueAutomationRecipients(tenantId: string, batch: number): Promise<string[]> {
  const res = await db.transaction(async (tx) => {
    const claimed = await tx.execute(sql`
      WITH claimed AS (
        SELECT r.id
        FROM communication_automation_recipients r
        WHERE r.tenant_id = ${tenantId}
          AND r.status = 'queued'
        ORDER BY r.created_at
        LIMIT ${batch}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE communication_automation_recipients r
      SET status = 'failed', skip_reason = 'in_flight'
      FROM claimed
      WHERE r.id = claimed.id
      RETURNING r.id
    `);
    return (claimed.rows as { id: string }[]).map((r) => r.id);
  });
  return res;
}

async function processAutomationRecipient(tenantId: string, recipientId: string): Promise<'sent' | 'failed'> {
  const [recipient] = await db
    .select()
    .from(communicationAutomationRecipients)
    .where(and(eq(communicationAutomationRecipients.id, recipientId), eq(communicationAutomationRecipients.tenantId, tenantId)))
    .limit(1);
  if (!recipient) return 'failed';

  const [run] = await db
    .select()
    .from(communicationAutomationRuns)
    .where(eq(communicationAutomationRuns.id, recipient.runId))
    .limit(1);
  const [automation] = run
    ? await db
        .select()
        .from(communicationAutomations)
        .where(eq(communicationAutomations.id, run.automationId))
        .limit(1)
    : [undefined];

  const fail = async (reason: string) => {
    await db
      .update(communicationAutomationRecipients)
      .set({ status: 'failed', skipReason: reason })
      .where(eq(communicationAutomationRecipients.id, recipientId));
    if (run) await bumpAutomationRun(tenantId, run.id, { failedDelta: 1, queuedDelta: -1 });
    return 'failed' as const;
  };

  if (!run || !automation) return await fail('missing_automation');

  const [person] = automation.audienceKind === 'staff'
    ? await db.select().from(user).where(and(eq(user.id, recipient.personId), eq(user.tenantId, tenantId), inArray(user.role, STAFF_ROLES as any))).limit(1)
    : await db.select().from(user).where(and(eq(user.id, recipient.personId), eq(user.tenantId, tenantId), eq(user.role, 'student'))).limit(1);
  if (!person) return await fail('person_not_found');

  const contactChannel = automation.channel as Channel;
  const needsPhone = SMS_LIKE.includes(contactChannel);
  const to = automation.audienceKind === 'student'
    ? (needsPhone ? person.guardianPhone : person.guardianEmail)
    : (needsPhone ? person.phone : person.email);
  if (!to) return await fail('invalid_contact');

  const consent = await checkConsent(tenantId, (automation.audienceKind === 'staff' ? 'staff' : 'student') as any, person.id, contactChannel);
  if (consent.reason !== 'ok') return await fail(consent.reason);

  const connection = automation.connectionId ? await getConnectionWithSecrets(tenantId, automation.connectionId) : null;
  const provider = getProvider(connection?.provider ?? 'test');
  if (!provider) return await fail('unknown_provider');

  const version = automation.templateId ? await getPublishedVersion(tenantId, automation.templateId) : null;
  const rendered = version
    ? renderVersion(version, { firstName: person.firstName ?? person.name ?? '', lastName: person.lastName ?? '', name: person.name ?? '' })
    : { bodyText: '', subject: undefined };

  const result = await provider.send({
    channel: contactChannel,
    to,
    subject: rendered.subject,
    bodyText: rendered.bodyText,
    ...(connection?.configJson ? { config: connection.configJson as Record<string, unknown> } : {}),
  });

  if (result.ok) {
    await db
      .update(communicationAutomationRecipients)
      .set({ status: 'sent', skipReason: null })
      .where(eq(communicationAutomationRecipients.id, recipientId));
    if (run) await bumpAutomationRun(tenantId, run.id, { queuedDelta: -1 });
    return 'sent';
  }
  return await fail(result.failureReason ?? 'provider_failure');
}

// Runs have no sent counter; sent recipients drain the queued bucket so that
// created = queued + skipped + failed remains exact after processing.
async function bumpAutomationRun(tenantId: string, runId: string, deltas: { failedDelta?: number; queuedDelta?: number }) {
  const set: Record<string, unknown> = {};
  if (deltas.failedDelta) set.failedCount = sql`${communicationAutomationRuns.failedCount} + ${deltas.failedDelta}`;
  if (deltas.queuedDelta) set.queuedCount = sql`greatest(0, ${communicationAutomationRuns.queuedCount} + ${deltas.queuedDelta})`;
  await db
    .update(communicationAutomationRuns)
    .set(set)
    .where(and(eq(communicationAutomationRuns.id, runId), eq(communicationAutomationRuns.tenantId, tenantId)));
}

// ---------------------------------------------------------------------------
// Public entry: process one tenant's due queue
// ---------------------------------------------------------------------------

export async function processBroadcastQueue(tenantId: string, opts: { batch?: number } = {}): Promise<WorkerSummary> {
  const batch = opts.batch ?? 50;
  const summary: WorkerSummary = {
    promotedCampaigns: 0,
    claimedCampaigns: 0,
    createdDeliveries: 0,
    claimedDeliveries: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    retried: 0,
    automationSent: 0,
    automationFailed: 0,
  };

  summary.promotedCampaigns = await promoteScheduled(tenantId);

  // Enqueue queued campaigns until none left (each claim is one campaign).
  let createdTotal = 0;
  for (let i = 0; i < 10; i += 1) {
    const created = await claimAndEnqueueCampaign(tenantId);
    if (created === 0) break;
    summary.claimedCampaigns += 1;
    createdTotal += created;
  }
  summary.createdDeliveries = createdTotal;

  let claimed = await claimDueDeliveries(tenantId, batch);
  summary.claimedDeliveries = claimed.length;
  while (claimed.length > 0 && summary.claimedDeliveries <= batch) {
    for (const id of claimed) {
      const outcome = await processDelivery(tenantId, id);
      if (outcome === 'sent') summary.sent += 1;
      else if (outcome === 'delivered') summary.delivered += 1;
      else if (outcome === 'failed') summary.failed += 1;
      else if (outcome === 'retried') summary.retried += 1;
    }
    claimed = await claimDueDeliveries(tenantId, batch);
    summary.claimedDeliveries += claimed.length;
    if (summary.claimedDeliveries > batch * 4) break; // safety valve
  }

  const automationIds = await claimDueAutomationRecipients(tenantId, batch);
  for (const id of automationIds) {
    const outcome = await processAutomationRecipient(tenantId, id);
    if (outcome === 'sent') summary.automationSent += 1;
    else summary.automationFailed += 1;
  }

  return summary;
}
