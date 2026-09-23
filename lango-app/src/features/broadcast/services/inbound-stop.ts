import { and, eq, gte } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { normalizeMoroccanPhone } from '@/libs/sms/moroccan-sms-adapter';
import {
  communicationCampaignRecipients,
  communicationSuppressions,
  smsMessages,
} from '@/models/Schema';

// Opt-out keywords in French, English, Arabic and Darija transliteration.
const STOP_KEYWORDS = new Set([
  'stop', 'stopall', 'arret', 'arrêt', 'unsubscribe', 'desabonner', 'désabonner',
  'توقف', 'الغاء', 'إلغاء', 'baraka',
]);

/** True when the first word of an inbound reply is an opt-out keyword. */
export function isStopKeyword(text: string): boolean {
  const first = text.trim().toLowerCase().split(/\s+/)[0] ?? '';
  return STOP_KEYWORDS.has(first.replace(/[.!]+$/, ''));
}

/**
 * Inbound STOP: suppress the number in every tenant that messaged it in the
 * last 180 days. The sender id can be shared, so a reply cannot always be
 * attributed to one school; over-suppressing is the compliant side of that
 * ambiguity. Returns how many tenants now suppress the number.
 */
export async function handleInboundStop(from: string, provider: string): Promise<number> {
  const phone = normalizeMoroccanPhone(from) || from;
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const smsTenants = await db.selectDistinct({ tenantId: smsMessages.tenantId }).from(smsMessages)
    .where(and(eq(smsMessages.recipientPhone, phone), gte(smsMessages.createdAt, since)));
  const campaignTenants = await db.selectDistinct({ tenantId: communicationCampaignRecipients.tenantId })
    .from(communicationCampaignRecipients)
    .where(eq(communicationCampaignRecipients.phone, phone));
  const tenantIds = [...new Set([...smsTenants, ...campaignTenants].map(r => r.tenantId))];

  for (const tenantId of tenantIds) {
    const [existing] = await db.select({ id: communicationSuppressions.id }).from(communicationSuppressions)
      .where(and(
        eq(communicationSuppressions.tenantId, tenantId),
        eq(communicationSuppressions.recipientKind, 'external'),
        eq(communicationSuppressions.recipientId, phone),
      ))
      .limit(1);
    if (!existing) {
      await db.insert(communicationSuppressions).values({
        tenantId,
        recipientKind: 'external',
        recipientId: phone,
        channel: null,
        reason: `STOP reçu via ${provider}`,
        createdBy: null,
      });
    }
  }
  return tenantIds.length;
}
