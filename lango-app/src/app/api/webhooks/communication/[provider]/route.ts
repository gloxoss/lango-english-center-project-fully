// Inbound provider webhook for delivery status (delivered/bounced/complained).
// Signature + timestamp verification with replay protection; state updates are
// append-only via communication_delivery_events and restricted to valid
// transitions, so a replayed or late webhook is a no-op rather than an error.
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { apiErrorResponse } from '@/libs/api/errors';
import {
  communicationDeliveries,
  communicationDeliveryEvents,
} from '@/models/Schema';

type Ctx = { params: Promise<{ provider: string }> };

const HMAC_SECRET = process.env.WEBHOOK_SIGNING_KEY || process.env.BETTER_AUTH_SECRET || 'lango-webhook-secret-sentinel';
const MAX_AGE_MS = 5 * 60 * 1000;

const VALID_TRANSITIONS: Record<string, string[]> = {
  queued: ['sent', 'delivered', 'failed', 'bounced', 'complained'],
  sent: ['delivered', 'bounced', 'complained', 'failed'],
  delivered: [],
  failed: ['delivered'],
  bounced: [],
  complained: [],
};

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function verifySignature(request: Request, rawBody: string, ts: string, signature: string): boolean {
  if (!signature.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', HMAC_SECRET).update(`${ts}.${rawBody}`).digest('hex');
  return timingSafeEqualHex(signature.slice('sha256='.length), expected);
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { provider } = await params;
    const rawBody = await request.text();

    const ts = request.headers.get('x-webhook-timestamp');
    const signature = request.headers.get('x-webhook-signature');
    if (!ts || !signature) {
      return NextResponse.json({ success: false, error: 'missing_signature' }, { status: 401 });
    }
    const tsMs = Number(ts);
    if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > MAX_AGE_MS) {
      return NextResponse.json({ success: false, error: 'stale_timestamp' }, { status: 401 });
    }
    if (!verifySignature(request, rawBody, ts, signature)) {
      return NextResponse.json({ success: false, error: 'invalid_signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody) as {
      providerRef?: string;
      status?: string;
      timestamp?: string;
      id?: string;
    };
    const status = (event.status ?? '').toLowerCase();
    if (!event.providerRef || !['sent', 'delivered', 'bounced', 'complained'].includes(status)) {
      return NextResponse.json({ success: false, error: 'unprocessable' }, { status: 422 });
    }

    // Provider refs are globally unique; match without exposing any tenant's data.
    const [delivery] = await db
      .select()
      .from(communicationDeliveries)
      .where(eq(communicationDeliveries.providerRef, event.providerRef))
      .limit(1);
    if (!delivery) {
      return NextResponse.json({ success: false, error: 'unknown_delivery' }, { status: 404 });
    }

    const allowed = VALID_TRANSITIONS[delivery.status] ?? [];
    if (!allowed.includes(status)) {
      // Non-destructive replay: log as webhook_received, keep state unchanged.
      await db.insert(communicationDeliveryEvents).values({
        tenantId: delivery.tenantId,
        deliveryId: delivery.id,
        campaignId: delivery.campaignId,
        eventType: 'webhook_received',
        status,
        detail: { ignored: true, previous: delivery.status, provider },
      });
      return NextResponse.json({ success: true, data: { ignored: true, deliveryStatus: delivery.status } });
    }

    const set: Record<string, unknown> = {
      status,
      lockedUntil: null,
      nextRetryAt: null,
      updatedAt: new Date().toISOString(),
    };
    if (status === 'delivered') set.deliveredAt = new Date().toISOString();
    if (['failed', 'bounced'].includes(status)) set.failedAt = new Date().toISOString();
    if (status === 'sent') set.sentAt = new Date().toISOString();
    await db
      .update(communicationDeliveries)
      .set(set as any)
      .where(and(eq(communicationDeliveries.id, delivery.id), eq(communicationDeliveries.tenantId, delivery.tenantId)));

    await db.insert(communicationDeliveryEvents).values({
      tenantId: delivery.tenantId,
      deliveryId: delivery.id,
      campaignId: delivery.campaignId,
      eventType: 'webhook_received',
      status,
      detail: { provider, providerRef: event.providerRef, eventTimestamp: event.timestamp ?? null },
    });

    // Pull the campaign counters back into sync for the affected campaign.
    await db.execute(sql`
      UPDATE communication_campaigns c
      SET
        sent_count = stats.sent,
        delivered_count = stats.delivered,
        failed_count = stats.failed,
        status = CASE
          WHEN stats.sent + stats.failed >= stats.total AND stats.total > 0
            THEN CASE WHEN stats.sent > 0 THEN 'completed'::communication_campaign_status ELSE 'failed'::communication_campaign_status END
          ELSE c.status END,
        completed_at = CASE
          WHEN stats.sent + stats.failed >= stats.total AND stats.total > 0 THEN now()
          ELSE c.completed_at END
      FROM (
        SELECT
          campaign_id,
          count(*)::int AS total,
          count(*) FILTER (WHERE status IN ('sent','delivered'))::int AS sent,
          count(*) FILTER (WHERE status = 'delivered')::int AS delivered,
          count(*) FILTER (WHERE status IN ('failed','bounced'))::int AS failed
        FROM communication_deliveries
        WHERE campaign_id = ${delivery.campaignId}
        GROUP BY campaign_id
      ) stats
      WHERE c.id = stats.campaign_id AND c.tenant_id = ${delivery.tenantId}
    `);

    return NextResponse.json({ success: true, data: { deliveryStatus: status } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
