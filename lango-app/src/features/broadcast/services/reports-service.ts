// Delivery reports: aggregate breakdown per campaign plus a contact-masked CSV
// export. Tenant-scoped on every query; export rows carry only recipient
// display fields that already flowed from the segment computation (name /
// phone / email / delivery state) — no guardian, student, HR or finance
// projections, and no internal recipient ids.
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  communicationCampaignRecipients,
  communicationCampaigns,
  communicationDeliveries,
} from '@/models/Schema';
import { ApiError } from '@/libs/api/errors';

export type CampaignReport = {
  campaignId: string;
  name: string;
  channel: string;
  status: string;
  scheduleAt: string | null;
  counts: {
    targeted: number;
    enqueued: number;
    sent: number;
    delivered: number;
    failed: number;
    skipped: number;
    pending: number;
    invalid: number;
    dedup: number;
    consentExcluded: number;
    suppressionExcluded: number;
  };
  byStatus: { status: string; n: number }[];
};

/** Mask a phone or email for safe sharing (e.g. "06…23", "a***@x.fr"). */
export function maskContact(kind: 'phone' | 'email', value: string | null): string | null {
  if (!value) return null;
  if (kind === 'phone') {
    if (value.length < 6) return value[0] + '…';
    return value.slice(0, 2) + '…' + value.slice(-2);
  }
  const [local, domain] = value.split('@');
  if (!domain || local === undefined) return value;
  const head = local.slice(0, 2) + '***';
  return `${head}@${domain}`;
}

export async function getCampaignReport(tenantId: string, campaignId: string): Promise<CampaignReport> {
  const [campaign] = await db
    .select()
    .from(communicationCampaigns)
    .where(and(eq(communicationCampaigns.id, campaignId), eq(communicationCampaigns.tenantId, tenantId)))
    .limit(1);
  if (!campaign) throw new ApiError(404, 'NOT_FOUND', 'Campagne introuvable.');

  const byStatus = await db
    .select({ status: communicationDeliveries.status, n: sql<number>`count(*)::int` })
    .from(communicationDeliveries)
    .where(and(
      eq(communicationDeliveries.tenantId, tenantId),
      eq(communicationDeliveries.campaignId, campaignId),
    ))
    .groupBy(communicationDeliveries.status);

  const statusMap = new Map(byStatus.map((r) => [r.status, r.n]));
  const get = (s: string) => statusMap.get(s as any) ?? 0;

  const [skippedRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(communicationCampaignRecipients)
    .where(and(
      eq(communicationCampaignRecipients.tenantId, tenantId),
      eq(communicationCampaignRecipients.campaignId, campaignId),
      eq(communicationCampaignRecipients.status, 'skipped'),
    ));

  return {
    campaignId: campaign.id,
    name: campaign.name,
    channel: campaign.channel,
    status: campaign.status,
    scheduleAt: campaign.scheduleAt,
    counts: {
      targeted: campaign.targetedCount,
      enqueued: campaign.enqueuedCount,
      sent: get('sent') + get('delivered'),
      delivered: get('delivered'),
      failed: get('failed') + get('bounced'),
      skipped: skippedRow?.n ?? 0,
      pending: get('queued'),
      invalid: campaign.invalidCount,
      dedup: campaign.dedupCount,
      consentExcluded: campaign.consentExcludedCount,
      suppressionExcluded: campaign.suppressionExcludedCount,
    },
    byStatus: byStatus.map((r) => ({ status: r.status, n: r.n })),
  };
}

export type ExportRow = {
  name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  skipReason: string | null;
  providerStatus: string | null;
  sentAt: string | null;
};

export async function exportCampaignRows(tenantId: string, campaignId: string): Promise<ExportRow[]> {
  const [campaign] = await db
    .select({ id: communicationCampaigns.id })
    .from(communicationCampaigns)
    .where(and(eq(communicationCampaigns.id, campaignId), eq(communicationCampaigns.tenantId, tenantId)))
    .limit(1);
  if (!campaign) throw new ApiError(404, 'NOT_FOUND', 'Campagne introuvable.');

  const recipients = await db
    .select()
    .from(communicationCampaignRecipients)
    .where(and(
      eq(communicationCampaignRecipients.tenantId, tenantId),
      eq(communicationCampaignRecipients.campaignId, campaignId),
    ))
    .orderBy(communicationCampaignRecipients.createdAt);

  const rows: ExportRow[] = [];
  for (const r of recipients) {
    const [d] = await db
      .select({ status: communicationDeliveries.status, sentAt: communicationDeliveries.sentAt })
      .from(communicationDeliveries)
      .where(eq(communicationDeliveries.recipientId, r.id))
      .limit(1);
    rows.push({
      name: r.contactName,
      phone: maskContact('phone', r.phone),
      email: maskContact('email', r.email),
      status: r.status,
      skipReason: r.skipReason,
      providerStatus: d?.status ?? null,
      sentAt: d?.sentAt ?? null,
    });
  }
  return rows;
}

export function exportToCsv(rows: ExportRow[]): string {
  const header = ['name', 'phone', 'email', 'status', 'skip_reason', 'provider_status', 'sent_at'];
  const esc = (v: string | null) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.name, r.phone, r.email, r.status, r.skipReason, r.providerStatus, r.sentAt].map(esc).join(','));
  }
  return lines.join('\n');
}
