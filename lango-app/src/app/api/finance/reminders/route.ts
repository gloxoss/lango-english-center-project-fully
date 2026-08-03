import { and, desc, eq, lt, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { guardians, guardianStudents, invoices, smsMessages, user } from '@/models/Schema';

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
// invoice. Log-only SMS, matching this app's established honest-simulation
// convention (see smsMessages schema comment / attendance's absence-SMS).
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, sendReminderSchema);

    const [invoice] = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, studentId: invoices.studentId, netAmount: invoices.netAmount, paidAmount: invoices.paidAmount })
      .from(invoices)
      .where(and(eq(invoices.id, body.invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);
    if (!invoice) {
      throw new ApiError(404, 'NOT_FOUND', 'Facture introuvable.');
    }

    const [guardian] = await db
      .select({ phone: guardians.phone })
      .from(guardianStudents)
      .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
      .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, invoice.studentId)))
      .orderBy(desc(guardianStudents.isPrimaryContact))
      .limit(1);

    if (!guardian?.phone) {
      throw new ApiError(422, 'NO_GUARDIAN', 'Aucun tuteur avec téléphone lié à cet élève.');
    }

    const balance = Number(invoice.netAmount) - Number(invoice.paidAmount);
    const [sms] = await db.insert(smsMessages).values({
      tenantId,
      recipientPhone: guardian.phone,
      studentId: invoice.studentId,
      body: `Rappel : la facture ${invoice.invoiceNumber} (solde ${balance.toFixed(2)} MAD) est en retard de paiement.`,
      status: 'sent',
      sentAt: new Date().toISOString(),
      createdById: context.userId,
    }).returning();

    recordAudit(context, 'create', 'payment_reminder', invoice.id, { smsId: sms!.id });

    return NextResponse.json({ success: true, data: sms, message: 'Rappel envoyé (SMS simulé).' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
