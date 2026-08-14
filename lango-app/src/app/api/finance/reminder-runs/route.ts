import { and, desc, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { financeReminderRuns, financeReminderRules, guardians, guardianStudents, invoices, smsMessages, user } from '@/models/Schema';

const runSchema = z.object({
  ruleId: z.string().uuid(),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

// GET /api/finance/reminder-runs — past reminder runs, tenant-scoped.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.read');

    const rows = await db
      .select()
      .from(financeReminderRuns)
      .where(eq(financeReminderRuns.tenantId, tenantId))
      .orderBy(desc(financeReminderRuns.startedAt));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST /api/finance/reminder-runs — run a reminder rule: snapshot the eligible
// overdue invoices (balance >= minBalance, capped per student), send log-only
// SMS to each student's primary guardian and record delivery evidence.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, runSchema);
    const today = body.asOfDate ?? new Date().toISOString().slice(0, 10);

    const [rule] = await db
      .select()
      .from(financeReminderRules)
      .where(and(eq(financeReminderRules.id, body.ruleId), eq(financeReminderRules.tenantId, tenantId)))
      .limit(1);
    if (!rule) {
      throw new ApiError(404, 'NOT_FOUND', 'Règle de rappel introuvable.');
    }
    if (rule.status !== 'active') {
      throw new ApiError(409, 'RULE_PAUSED', 'Cette règle de rappel est en pause.');
    }

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
        lt(invoices.dueDate, today),
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

    // Primary guardian phone per student (best-effort).
    const studentIds = [...new Set(selected.map(s => s.studentId))];
    const guardianPhone = new Map<string, string>();
    if (studentIds.length > 0) {
      const gRows = await db
        .select({
          studentId: guardianStudents.studentId,
          phone: guardians.phone,
          isPrimaryContact: guardianStudents.isPrimaryContact,
        })
        .from(guardianStudents)
        .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
        .where(and(eq(guardianStudents.tenantId, tenantId), inArray(guardianStudents.studentId, studentIds)));
      for (const g of gRows) {
        const existing = guardianPhone.has(g.studentId);
        if (!existing || g.isPrimaryContact) guardianPhone.set(g.studentId, g.phone ?? '');
      }
    }

    const [run] = await db
      .insert(financeReminderRuns)
      .values({
        tenantId,
        ruleId: body.ruleId,
        runDate: today,
        status: 'running',
        startedById: context.userId,
      })
      .returning();

    let sentCount = 0;
    const sent: { invoiceNumber: string; studentId: string; recipientPhone: string | null }[] = [];
    for (const inv of selected) {
      const phone = guardianPhone.get(inv.studentId) ?? null;
      if (!phone) continue;
      const balance = Number(inv.netAmount) - Number(inv.paidAmount);
      await db.insert(smsMessages).values({
        tenantId,
        recipientPhone: phone,
        studentId: inv.studentId,
        body: `Rappel : la facture ${inv.invoiceNumber} (solde ${balance.toFixed(2)} MAD) est en retard.`,
        status: 'sent',
        sentAt: new Date().toISOString(),
        createdById: context.userId,
      });
      sentCount += 1;
      sent.push({ invoiceNumber: inv.invoiceNumber, studentId: inv.studentId, recipientPhone: phone });
    }

    const [completed] = await db
      .update(financeReminderRuns)
      .set({ status: 'completed', completedAt: new Date().toISOString(), recipientsCount: selected.length, sentCount, results: { ruleId: rule.id, sent } })
      .where(eq(financeReminderRuns.id, run!.id))
      .returning();

    recordAudit(context, 'create', 'finance_reminder_run', run!.id, { recipients: selected.length, sent: sentCount });

    return NextResponse.json({
      success: true,
      data: completed!,
      message: `${sentCount}/${selected.length} rappel(s) envoyé(s) (SMS simulé).`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
