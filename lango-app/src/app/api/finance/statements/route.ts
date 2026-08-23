import { type NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { addDays } from '@/libs/finance/allocation';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { studentCredits } from '@/features/finance/models/student-accounting-schema';
import { invoices, paymentAllocations, payments, user } from '@/models/Schema';

// GET /api/finance/statements?studentId=...&startDate=...&endDate=...
// Per-student account statement. Equation: opening + charges − credits = closing.
// - opening = net of issued invoices due before startDate (cancelled/draft
//   excluded) minus payments and invoice-credits recorded before startDate.
// - charges = net of issued invoices due in [startDate, endDate] (a credited
//   invoice keeps its charge; the student credit offsets it below).
// - credits = payment allocations + invoice credits in [startDate, endDate].
// All money math runs in BigInt cents; dates compare as UTC days, never strings.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dateToDays(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

const ISSUED = ['pending', 'partial', 'paid', 'overdue', 'credited'] as const;

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin', 'accountant']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'finance.read');

    const searchParams = new URL(req.url).searchParams;
    const studentId = searchParams.get('studentId');
    if (!studentId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Le paramètre studentId est requis.');
    }

    const [student] = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)))
      .limit(1);
    if (!student) {
      throw new ApiError(404, 'NOT_FOUND', 'Étudiant introuvable.');
    }

    const startDate = searchParams.get('startDate') ?? null;
    const endDate = searchParams.get('endDate') ?? null;
    if (startDate && !DATE_PATTERN.test(startDate)) throw new ApiError(400, 'BAD_REQUEST', 'startDate doit être au format YYYY-MM-DD.');
    if (endDate && !DATE_PATTERN.test(endDate)) throw new ApiError(400, 'BAD_REQUEST', 'endDate doit être au format YYYY-MM-DD.');

    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, studentId)));
    const payRows = await db
      .select()
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.studentId, studentId),
        eq(payments.status, 'posted'),
      ));
    const payIds = payRows.map(p => p.id);
    const allocRows = payIds.length
      ? await db.select().from(paymentAllocations).where(and(eq(paymentAllocations.tenantId, tenantId), inArray(paymentAllocations.paymentId, payIds)))
      : [];
    const creditRows = await db
      .select()
      .from(studentCredits)
      .where(and(eq(studentCredits.tenantId, tenantId), eq(studentCredits.studentId, studentId), eq(studentCredits.source, 'invoice_credit')));

    // Default window: 60 days before the earliest activity, ending today.
    const activityDates: string[] = [
      ...invoiceRows.map(i => i.issueDate),
      ...invoiceRows.map(i => i.dueDate),
      ...payRows.map(p => p.paymentDate.slice(0, 10)),
      ...creditRows.map(c => c.createdAt.slice(0, 10)),
    ].filter((d): d is string => Boolean(d));
    const today = new Date().toISOString().slice(0, 10);
    const effectiveStart = startDate ?? (activityDates.length ? addDays(activityDates.reduce((min, d) => (d! < min ? d! : min)), -60) : addDays(today, -60));
    const effectiveEnd = endDate ?? today;
    if (dateToDays(effectiveStart) > dateToDays(effectiveEnd)) {
      throw new ApiError(400, 'BAD_REQUEST', 'startDate ne peut pas être après endDate.');
    }

    const payById = new Map(payRows.map(p => [p.id, p]));

    type Row = { id: string; date: string; type: 'invoice' | 'payment' | 'credit'; description: string; reference: string; debitCents: bigint; creditCents: bigint };
    const transactions: Row[] = [];
    let openingCents = BigInt(0);

    for (const inv of invoiceRows) {
      if (!ISSUED.includes(inv.status as (typeof ISSUED)[number])) continue;
      const netCents = moneyToCents(String(inv.netAmount));
      const due = dateToDays(inv.dueDate);
      if (due < dateToDays(effectiveStart)) openingCents += netCents;
      else if (due <= dateToDays(effectiveEnd)) {
        transactions.push({ id: inv.id, date: inv.dueDate, type: 'invoice', description: `Facture ${inv.invoiceNumber}`, reference: inv.invoiceNumber, debitCents: netCents, creditCents: BigInt(0) });
      }
    }

    for (const alloc of allocRows) {
      const pay = payById.get(alloc.paymentId);
      if (!pay) continue;
      const amountCents = moneyToCents(String(alloc.allocatedAmount));
      const payDate = pay.paymentDate.slice(0, 10);
      const days = dateToDays(payDate);
      if (days < dateToDays(effectiveStart)) openingCents -= amountCents;
      else if (days <= dateToDays(effectiveEnd)) {
        transactions.push({
          id: alloc.id, date: payDate, type: 'payment',
          description: `Paiement — ${pay.paymentMethod}`,
          reference: pay.referenceId ?? alloc.id.slice(0, 8),
          debitCents: BigInt(0), creditCents: amountCents,
        });
      }
    }

    for (const credit of creditRows) {
      const amountCents = moneyToCents(String(credit.amount));
      const creditDate = credit.createdAt.slice(0, 10);
      const days = dateToDays(creditDate);
      if (days < dateToDays(effectiveStart)) openingCents -= amountCents;
      else if (days <= dateToDays(effectiveEnd)) {
        transactions.push({
          id: credit.id, date: creditDate, type: 'credit',
          description: `Crédit élève (${credit.note ?? 'facture'})`,
          reference: credit.note ?? 'invoice_credit',
          debitCents: BigInt(0), creditCents: amountCents,
        });
      }
    }

    transactions.sort((a, b) => dateToDays(a.date) - dateToDays(b.date));

    let running = openingCents;
    const enriched = transactions.map(t => {
      running += t.debitCents - t.creditCents;
      return {
        id: t.id,
        date: t.date,
        type: t.type,
        description: t.description,
        reference: t.reference,
        debit: Number(centsToMoney(t.debitCents)),
        credit: Number(centsToMoney(t.creditCents)),
        balance: Number(centsToMoney(running)),
      };
    });

    const chargesCents = transactions.reduce((sum, t) => sum + t.debitCents, BigInt(0));
    const creditsCents = transactions.reduce((sum, t) => sum + t.creditCents, BigInt(0));

    return NextResponse.json({
      success: true,
      data: {
        studentId,
        studentName: student.name,
        period: { startDate: effectiveStart, endDate: effectiveEnd },
        openingBalance: Number(centsToMoney(openingCents)),
        chargesTotal: Number(centsToMoney(chargesCents)),
        creditsTotal: Number(centsToMoney(creditsCents)),
        closingBalance: Number(centsToMoney(running)),
        transactions: enriched,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
