import { and, desc, eq, lt, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { invoices, user } from '@/models/Schema';
import { sendSingleInvoiceReminder } from '@/libs/services/finance-reminders';

// GET /api/finance/reminders — real overdue-invoice list (dueDate passed,
// not fully paid), tenant-scoped.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');

    const today = new Date().toISOString().slice(0, 10);
    const rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        studentId: invoices.studentId,
        studentName: user.name,
        dueDate: invoices.dueDate,
        netAmount: invoices.netAmount,
        paidAmount: invoices.paidAmount,
        status: invoices.status,
      })
      .from(invoices)
      .innerJoin(user, eq(invoices.studentId, user.id))
      .where(and(
        eq(invoices.tenantId, tenantId),
        lt(invoices.dueDate, today),
        ne(invoices.status, 'paid'),
      ))
      .orderBy(desc(invoices.dueDate));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const sendReminderSchema = z.object({
  invoiceId: z.string().uuid(),
}).strict();

// POST /api/finance/reminders — send a payment reminder for one overdue
// invoice through the Broadcast pipeline (campaign → recipient → delivery via
// the outbox worker), instead of the previous direct sms_messages insert.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, sendReminderSchema);

    const reminder = await sendSingleInvoiceReminder(tenantId, body.invoiceId, context.userId);

    recordAudit(context, 'create', 'payment_reminder', body.invoiceId, { campaignId: reminder.id });

    return NextResponse.json({ success: true, data: reminder, message: 'Rappel envoyé (SMS simulé).' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
