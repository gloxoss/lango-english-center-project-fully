import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { csvSafeCell } from '@/libs/csv-safe';
import { db } from '@/libs/DB';
import { employeeProfiles, salaryPaymentBatches, salaryPayments, user } from '@/models/Schema';
import { isBankPaymentMethod, missingBankRibCount } from '@/features/workforce/services/payment-bank';

const exportableBatchStatuses = new Set(['approved', 'exported', 'submitted', 'paid']);

/** Export a reviewed bank batch as a semicolon-delimited transfer review CSV. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId);
    await requireCapability(ctx, 'payroll.payment.prepare');
    await requireCapability(ctx, 'payroll.sensitive.read');
    const { id } = await params;

    const [batch] = await db.select().from(salaryPaymentBatches)
        .where(and(eq(salaryPaymentBatches.tenantId, tenantId), eq(salaryPaymentBatches.id, id)));
      if (!batch) throw new ApiError(404, 'PAYMENT_BATCH_NOT_FOUND', 'Lot de paiement introuvable.');
      if (!isBankPaymentMethod(batch.method)) throw new ApiError(409, 'PAYMENT_BATCH_NOT_BANK', 'Seuls les lots bancaires peuvent être exportés.');
      if (!exportableBatchStatuses.has(batch.status)) {
        throw new ApiError(409, 'PAYMENT_BATCH_NOT_APPROVED', 'Le lot doit être approuvé avant son export bancaire.');
      }

      const rows = await db.select({
        paymentId: salaryPayments.id,
        amount: salaryPayments.amount,
        userId: salaryPayments.userId,
        employeeName: user.name,
        employeeId: employeeProfiles.employeeId,
        bankRib: employeeProfiles.bankRib,
      })
        .from(salaryPayments)
        .innerJoin(user, and(eq(user.id, salaryPayments.userId), eq(user.tenantId, tenantId)))
        .leftJoin(employeeProfiles, and(eq(employeeProfiles.userId, salaryPayments.userId), eq(employeeProfiles.tenantId, tenantId)))
        .where(and(
          eq(salaryPayments.tenantId, tenantId),
          eq(salaryPayments.batchId, id),
          inArray(salaryPayments.status, ['pending', 'paid']),
        ));
      if (!rows.length) throw new ApiError(409, 'PAYMENT_BATCH_EMPTY', 'Le lot ne contient aucun paiement exportable.');
      const missingRib = missingBankRibCount(rows);
      if (missingRib > 0) {
        throw new ApiError(409, 'PAYROLL_BANK_RIB_MISSING', `Export bancaire bloqué : ${missingRib} salarié(s) n’ont pas de RIB enregistré.`);
      }

      const header = ['RIB', 'Bénéficiaire', 'Montant', 'Devise', 'Référence'];
      const lines = rows.map(row => [
        row.bankRib!.trim(),
        row.employeeName ?? row.userId,
        row.amount,
        'MAD',
        `SAL-${batch.id.slice(0, 8)}-${row.paymentId.slice(0, 8)}`,
      ].map(csvSafeCell).join(';'));
      const csv = `\ufeff${[header.map(csvSafeCell).join(';'), ...lines].join('\r\n')}\r\n`;

      const result = { csv, count: rows.length, filename: `salaires-${batch.runId}-${new Date().toISOString().slice(0, 10)}.csv` };

    recordAudit(ctx, 'export', 'salary_payment_batch', id, { format: 'review_csv', count: result.count });
    return new NextResponse(result.csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
