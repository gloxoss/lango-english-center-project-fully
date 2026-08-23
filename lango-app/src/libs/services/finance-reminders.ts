import { and, desc, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import {
  communicationCampaignRecipients,
  communicationCampaigns,
  communicationDeliveries,
  financeReminderRuns,
  financeReminderRules,
  guardians,
  guardianStudents,
  invoices,
} from '@/models/Schema';
import { processBroadcastQueue } from '@/features/broadcast/services/outbox-worker';

// Shared finance-reminder engine: snapshot overdue invoices for a rule, then
// dispatch through the Broadcast pipeline (campaigns → recipient snapshots →
// deliveries via the outbox worker) instead of writing sms_messages directly.
// This inherits the Broadcast honesty convention (log/test provider, no real
// carrier), consent/suppression re-checks and the append-only delivery log.

type Rule = typeof financeReminderRules.$inferSelect;

function toMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True when `now` falls inside the rule's quiet window (inclusive start, exclusive end). */
export function isWithinQuietHours(rule: { quietStart: string | null; quietEnd: string | null }, now = new Date()): boolean {
  if (!rule.quietStart || !rule.quietEnd) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(rule.quietStart);
  const end = toMinutes(rule.quietEnd);
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

async function getGuardianContact(tenantId: string, studentIds: string[]): Promise<Map<string, { guardianId: string; phone: string; name: string }>> {
  const map = new Map<string, { guardianId: string; phone: string; name: string }>();
  if (studentIds.length === 0) return map;
  const rows = await db
    .select({
      studentId: guardianStudents.studentId,
      guardianId: guardians.id,
      phone: guardians.phone,
      firstName: guardians.firstName,
      lastName: guardians.lastName,
      isPrimaryContact: guardianStudents.isPrimaryContact,
    })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
    .where(and(eq(guardianStudents.tenantId, tenantId), inArray(guardianStudents.studentId, studentIds)));
  for (const g of rows) {
    const existing = map.get(g.studentId);
    if (!existing || g.isPrimaryContact) {
      map.set(g.studentId, {
        guardianId: g.guardianId,
        phone: g.phone ?? '',
        name: `${g.firstName} ${g.lastName}`.trim(),
      });
    }
  }
  return map;
}

/**
 * Run one active reminder rule: snapshot eligible overdue invoices, dispatch a
 * per-invoice SMS campaign through Broadcast, and record the run. Returns the
 * completed run row.
 */
export async function runFinanceReminderRule(tenantId: string, rule: Rule, actorId: string | null, asOfDate: string) {
  const overdue = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      studentId: invoices.studentId,
      dueDate: invoices.dueDate,
      netAmount: invoices.netAmount,
      paidAmount: invoices.paidAmount,
    })
    .from(invoices)
    .where(and(
      eq(invoices.tenantId, tenantId),
      ne(invoices.status, 'paid'),
      lt(invoices.dueDate, asOfDate),
      sql`(${invoices.netAmount} - ${invoices.paidAmount}) >= ${rule.minBalance}`,
    ));

  // Cap per student at maxPerStudent (oldest first).
  const byStudent = new Map<string, typeof overdue>();
  for (const inv of overdue) {
    const list = byStudent.get(inv.studentId) ?? [];
    list.push(inv);
    byStudent.set(inv.studentId, list);
  }
  const selected: typeof overdue = [];
  for (const list of byStudent.values()) {
    list.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
    selected.push(...list.slice(0, rule.maxPerStudent));
  }

  const [run] = await db
    .insert(financeReminderRuns)
    .values({ tenantId, ruleId: rule.id, runDate: asOfDate, status: 'running', startedById: actorId })
    .returning();

  let sentCount = 0;
  const sent: { invoiceNumber: string; recipientPhone: string | null; deliveryStatus: string | null }[] = [];

  if (selected.length > 0 && !isWithinQuietHours(rule)) {
    const studentIds = [...new Set(selected.map(s => s.studentId))];
    const contact = await getGuardianContact(tenantId, studentIds);

    const campaignByInvoice = new Map<string, string>();
    for (const inv of selected) {
      const guardian = contact.get(inv.studentId);
      if (!guardian?.phone) continue;
      const balance = Number(inv.netAmount) - Number(inv.paidAmount);
      const body = `Rappel : la facture ${inv.invoiceNumber} (solde ${balance.toFixed(2)} MAD) est en retard de paiement.`;

      const [campaign] = await db
        .insert(communicationCampaigns)
        .values({
          tenantId,
          name: `Relance de frais — ${inv.invoiceNumber}`,
          channel: 'sms',
          bodyText: body,
          status: 'queued',
          createdBy: actorId,
        })
        .returning();
      campaignByInvoice.set(inv.id, campaign!.id);
      await db.insert(communicationCampaignRecipients).values({
        tenantId,
        campaignId: campaign!.id,
        recipientKind: 'guardian',
        recipientId: guardian.guardianId,
        contactName: guardian.name || null,
        phone: guardian.phone,
        status: 'pending',
      });
    }

    const campaignIds = [...campaignByInvoice.values()];

    // Drain the queue until our campaigns are no longer queued/sending (bounded).
    for (let i = 0; i < 10 && campaignIds.length > 0; i += 1) {
      const [remaining] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(communicationCampaigns)
        .where(and(
          eq(communicationCampaigns.tenantId, tenantId),
          inArray(communicationCampaigns.id, campaignIds),
          sql`${communicationCampaigns.status} in ('queued','sending')`,
        ));
      if ((remaining?.n ?? 0) === 0) break;
      await processBroadcastQueue(tenantId);
    }

    const deliveries = await db
      .select({
        campaignId: communicationDeliveries.campaignId,
        status: communicationDeliveries.status,
      })
      .from(communicationDeliveries)
      .where(and(eq(communicationDeliveries.tenantId, tenantId), inArray(communicationDeliveries.campaignId, campaignIds)));

    const statusByCampaign = new Map<string, string>();
    for (const d of deliveries) statusByCampaign.set(d.campaignId, d.status);

    for (const inv of selected) {
      const guardian = contact.get(inv.studentId);
      const deliveryStatus = guardian?.phone ? (statusByCampaign.get(campaignByInvoice.get(inv.id) ?? '') ?? null) : null;
      if (deliveryStatus === 'sent' || deliveryStatus === 'delivered') sentCount += 1;
      sent.push({ invoiceNumber: inv.invoiceNumber, recipientPhone: guardian?.phone ?? null, deliveryStatus });
    }
  } else if (selected.length > 0 && isWithinQuietHours(rule)) {
    for (const inv of selected) {
      sent.push({ invoiceNumber: inv.invoiceNumber, recipientPhone: null, deliveryStatus: 'quiet_hours' });
    }
  }

  const [completed] = await db
    .update(financeReminderRuns)
    .set({
      status: 'completed',
      completedAt: new Date().toISOString(),
      recipientsCount: selected.length,
      sentCount,
      results: { ruleId: rule.id, quietHoursSkipped: selected.length > 0 && isWithinQuietHours(rule), sent },
    })
    .where(eq(financeReminderRuns.id, run!.id))
    .returning();

  return completed!;
}

/** Run every active reminder rule for the tenant (used by the feeReminderJob handler). */
export async function runAllActiveFinanceReminders(tenantId: string, actorId: string | null, asOfDate: string) {
  const rules = await db
    .select()
    .from(financeReminderRules)
    .where(and(eq(financeReminderRules.tenantId, tenantId), eq(financeReminderRules.status, 'active')))
    .orderBy(desc(financeReminderRules.updatedAt));

  let sentTotal = 0;
  let runs = 0;
  for (const rule of rules) {
    const run = await runFinanceReminderRule(tenantId, rule, actorId, asOfDate);
    sentTotal += run.sentCount;
    runs += 1;
  }
  return { runs, sentTotal };
}

/**
 * Send one manual payment reminder for a single overdue invoice through the
 * Broadcast pipeline (campaign → recipient → delivery via the outbox worker),
 * replacing the previous direct `sms_messages` insert.
 */
export async function sendSingleInvoiceReminder(tenantId: string, invoiceId: string, actorId: string | null) {
  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      studentId: invoices.studentId,
      netAmount: invoices.netAmount,
      paidAmount: invoices.paidAmount,
    })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .limit(1);
  if (!invoice) throw new ApiError(404, 'NOT_FOUND', 'Facture introuvable.');

  const contact = await getGuardianContact(tenantId, [invoice.studentId]);
  const guardian = contact.get(invoice.studentId);
  if (!guardian?.phone) {
    throw new ApiError(422, 'NO_GUARDIAN', 'Aucun tuteur avec téléphone lié à cet élève.');
  }

  const balance = Number(invoice.netAmount) - Number(invoice.paidAmount);
  const body = `Rappel : la facture ${invoice.invoiceNumber} (solde ${balance.toFixed(2)} MAD) est en retard de paiement.`;

  const [campaign] = await db
    .insert(communicationCampaigns)
    .values({
      tenantId,
      name: `Relance de frais — ${invoice.invoiceNumber}`,
      channel: 'sms',
      bodyText: body,
      status: 'queued',
      createdBy: actorId,
    })
    .returning();

  await db.insert(communicationCampaignRecipients).values({
    tenantId,
    campaignId: campaign!.id,
    recipientKind: 'guardian',
    recipientId: guardian.guardianId,
    contactName: guardian.name || null,
    phone: guardian.phone,
    status: 'pending',
  });

  // Drain the queue until this campaign is no longer queued/sending (bounded).
  for (let i = 0; i < 10; i += 1) {
    const [remaining] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(communicationCampaigns)
      .where(and(
        eq(communicationCampaigns.tenantId, tenantId),
        eq(communicationCampaigns.id, campaign!.id),
        sql`${communicationCampaigns.status} in ('queued','sending')`,
      ));
    if ((remaining?.n ?? 0) === 0) break;
    await processBroadcastQueue(tenantId);
  }

  const [delivery] = await db
    .select({ status: communicationDeliveries.status })
    .from(communicationDeliveries)
    .where(and(eq(communicationDeliveries.tenantId, tenantId), eq(communicationDeliveries.campaignId, campaign!.id)))
    .limit(1);

  return {
    id: campaign!.id,
    invoiceNumber: invoice.invoiceNumber,
    recipientPhone: guardian.phone,
    body,
    status: delivery?.status ?? 'sent',
    sentAt: new Date().toISOString(),
  };
}

export async function requireActiveReminderRule(tenantId: string, ruleId: string): Promise<Rule> {
  const [rule] = await db
    .select()
    .from(financeReminderRules)
    .where(and(eq(financeReminderRules.id, ruleId), eq(financeReminderRules.tenantId, tenantId)))
    .limit(1);
  if (!rule) throw new ApiError(404, 'NOT_FOUND', 'Règle de rappel introuvable.');
  if (rule.status !== 'active') throw new ApiError(409, 'RULE_PAUSED', 'Cette règle de rappel est en pause.');
  return rule;
}
