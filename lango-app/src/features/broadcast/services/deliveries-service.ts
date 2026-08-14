// Per-recipient drill-down: snapshot recipients with their live delivery
// status, the append-only delivery event trail, and manual retry. Every query
// is tenant-scoped; internal recipient ids are never exposed to other tenants.
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  communicationCampaignRecipients,
  communicationCampaigns,
  communicationDeliveries,
  communicationDeliveryEvents,
} from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import type { broadcastChannel } from '../models/broadcast-schema';

type Channel = (typeof broadcastChannel.enumValues)[number];

export function recipientPublic(r: typeof communicationCampaignRecipients.$inferSelect) {
  return {
    id: r.id,
    recipientKind: r.recipientKind,
    contactName: r.contactName,
    phone: r.phone,
    email: r.email,
    status: r.status,
    skipReason: r.skipReason,
    createdAt: r.createdAt,
  };
}

export function deliveryPublic(d: typeof communicationDeliveries.$inferSelect) {
  return {
    id: d.id,
    channel: d.channel,
    provider: d.provider,
    status: d.status,
    providerRef: d.providerRef,
    failureReason: d.failureReason,
    retryCount: d.retryCount,
    maxRetries: d.maxRetries,
    sentAt: d.sentAt,
    deliveredAt: d.deliveredAt,
    failedAt: d.failedAt,
    createdAt: d.createdAt,
  };
}

export type DeliveryRow = {
  recipient: ReturnType<typeof recipientPublic>;
  delivery: ReturnType<typeof deliveryPublic> | null;
};

export async function listCampaignRecipients(
  tenantId: string,
  campaignId: string,
  opts: { status?: string; page?: number; pageSize?: number } = {},
): Promise<{ rows: DeliveryRow[]; total: number }> {
  // Cross-tenant campaign ids must surface as 404, not as an empty list.
  const [campaign] = await db
    .select({ id: communicationCampaigns.id })
    .from(communicationCampaigns)
    .where(and(eq(communicationCampaigns.id, campaignId), eq(communicationCampaigns.tenantId, tenantId)))
    .limit(1);
  if (!campaign) throw new ApiError(404, 'NOT_FOUND', 'Campagne introuvable.');

  const pagination = parsePagination(new URLSearchParams({ page: String(opts.page ?? 1), pageSize: String(opts.pageSize ?? 20) }));
  const conditions: any[] = [
    eq(communicationCampaignRecipients.tenantId, tenantId),
    eq(communicationCampaignRecipients.campaignId, campaignId),
  ];
  if (opts.status) conditions.push(eq(communicationCampaignRecipients.status, opts.status as any));

  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(communicationCampaignRecipients)
    .where(and(...conditions));
  const total = countRow?.n ?? 0;

  const recipients = await db
    .select()
    .from(communicationCampaignRecipients)
    .where(and(...conditions))
    .orderBy(asc(communicationCampaignRecipients.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  const rows: DeliveryRow[] = [];
  for (const r of recipients) {
    const [d] = await db
      .select()
      .from(communicationDeliveries)
      .where(eq(communicationDeliveries.recipientId, r.id))
      .limit(1);
    rows.push({ recipient: recipientPublic(r), delivery: d ? deliveryPublic(d) : null });
  }
  return { rows, total };
}

export async function listDeliveryEvents(tenantId: string, deliveryId: string) {
  const [d] = await db
    .select()
    .from(communicationDeliveries)
    .where(and(eq(communicationDeliveries.id, deliveryId), eq(communicationDeliveries.tenantId, tenantId)))
    .limit(1);
  if (!d) throw new ApiError(404, 'NOT_FOUND', 'Envoi introuvable.');
  const events = await db
    .select()
    .from(communicationDeliveryEvents)
    .where(eq(communicationDeliveryEvents.deliveryId, deliveryId))
    .orderBy(asc(communicationDeliveryEvents.createdAt));
  return events.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    status: e.status,
    detail: e.detail,
    createdAt: e.createdAt,
  }));
}

/**
 * Manual retry of a failed/bounced delivery. Idempotent: retrying twice in a
 * row only schedules it once (a queued delivery is left alone).
 */
export async function retryDelivery(tenantId: string, deliveryId: string): Promise<ReturnType<typeof deliveryPublic>> {
  const [d] = await db
    .select()
    .from(communicationDeliveries)
    .where(and(eq(communicationDeliveries.id, deliveryId), eq(communicationDeliveries.tenantId, tenantId)))
    .limit(1);
  if (!d) throw new ApiError(404, 'NOT_FOUND', 'Envoi introuvable.');
  if (d.status === 'queued' || d.status === 'sent' || d.status === 'delivered') {
    return deliveryPublic(d);
  }
  const [updated] = await db
    .update(communicationDeliveries)
    .set({
      status: 'queued',
      retryCount: 0,
      nextRetryAt: new Date().toISOString(),
      lockedUntil: null,
      failedAt: null,
      failureReason: null,
      updatedAt: new Date().toISOString(),
    } as any)
    .where(and(eq(communicationDeliveries.id, deliveryId), eq(communicationDeliveries.tenantId, tenantId)))
    .returning();
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Envoi introuvable.');
  await db
    .update(communicationCampaignRecipients)
    .set({ status: 'queued', skipReason: null })
    .where(eq(communicationCampaignRecipients.id, d.recipientId));
  return deliveryPublic(updated);
}
