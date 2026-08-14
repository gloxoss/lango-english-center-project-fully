import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { consumeDocumentNumber } from '@/libs/finance/document-number';
import { addDays, allocationComponentSchema } from '@/libs/finance/allocation';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { feeAllocationRuns, feeAllocationTargets, feeStructureVersions, invoiceEvents, invoiceItems, invoices } from '@/models/Schema';

// POST /api/finance/fee-allocations/:id/run — generate one invoice per pending
// target, with line items derived from the version's immutable components.
// Idempotent: targets that already carry an invoice are skipped, so a retry
// after a timeout resumes without duplicating documents. Per-target failures
// are recorded on the target without aborting the rest of the run.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const { id } = await params;

    const [run] = await db
      .select()
      .from(feeAllocationRuns)
      .where(and(eq(feeAllocationRuns.id, id), eq(feeAllocationRuns.tenantId, tenantId)))
      .limit(1);
    if (!run) {
      throw new ApiError(404, 'ALLOCATION_RUN_NOT_FOUND', 'Lancement d\'allocation introuvable.');
    }
    if (run.status !== 'previewed' && run.status !== 'approved') {
      throw new ApiError(409, 'ALLOCATION_ALREADY_RUN', `Lancement déjà traité (statut ${run.status}).`);
    }

    let components: z.infer<typeof allocationComponentSchema>[] = [];
    let feeStructureId: string | null = null;
    if (run.feeStructureVersionId) {
      const [version] = await db
        .select()
        .from(feeStructureVersions)
        .where(and(eq(feeStructureVersions.id, run.feeStructureVersionId), eq(feeStructureVersions.tenantId, tenantId)))
        .limit(1);
      if (version) {
        feeStructureId = version.feeStructureId;
        const parsed = z.array(allocationComponentSchema).safeParse(version.componentsSnapshot);
        if (parsed.success && parsed.data.length > 0) components = parsed.data;
      }
    }

    const maxOffset = components.reduce((max, c) => Math.max(max, c.dueOffsetDays), 0);
    const baseDueDate = run.dueDate ?? addDays(new Date().toISOString().slice(0, 10), 30);
    const invoiceDueDate = addDays(baseDueDate, maxOffset);
    const year = new Date().getFullYear();
    const nowIso = new Date().toISOString();

    const targets = await db
      .select()
      .from(feeAllocationTargets)
      .where(and(eq(feeAllocationTargets.tenantId, tenantId), eq(feeAllocationTargets.runId, id), eq(feeAllocationTargets.status, 'pending')));

    let totalCents = BigInt(0);
    const created: { invoiceId: string; studentId: string; amount: number }[] = [];
    const errors: { studentId: string; message: string }[] = [];

    for (const target of targets) {
      if (target.invoiceId) continue;
      try {
        const amountCents = components.length > 0
          ? components.reduce((sum, c) => sum + moneyToCents(c.amount), BigInt(0))
          : moneyToCents(String(target.amount));
        const amountNum = Number(centsToMoney(amountCents));
        const items = components.length > 0
          ? components.map(c => ({ description: c.name, amount: Number(c.amount) }))
          : [{ description: run.period, amount: amountNum }];

        const invoiceId = await db.transaction(async (tx) => {
          const invoiceNumber = await consumeDocumentNumber(tx, { tenantId, prefix: `INV-${year}-` });
          const [invoice] = await tx
            .insert(invoices)
            .values({
              tenantId,
              studentId: target.studentId,
              feeStructureId,
              invoiceNumber,
              amount: amountNum,
              discountAmount: 0,
              netAmount: amountNum,
              paidAmount: 0,
              status: 'pending',
              dueDate: invoiceDueDate,
              note: `Allocation ${run.period}`,
            })
            .returning();
          if (!invoice) {
            throw new ApiError(500, 'INVOICE_INSERT_FAILED', 'Facture non enregistrée.');
          }
          await tx.insert(invoiceItems).values(items.map(it => ({
            tenantId,
            invoiceId: invoice.id,
            feeCategoryId: null,
            description: it.description,
            amount: it.amount,
          })));
          await tx.insert(invoiceEvents).values({
            tenantId,
            invoiceId: invoice.id,
            eventType: 'created',
            payload: { source: 'allocation', runId: id, period: run.period, invoiceNumber, amountCents: amountCents.toString() },
            actorUserId: context.userId,
          });
          return invoice.id;
        });

        await db
          .update(feeAllocationTargets)
          .set({ status: 'included', invoiceId, processedAt: nowIso })
          .where(eq(feeAllocationTargets.id, target.id));
        totalCents += amountCents;
        created.push({ invoiceId, studentId: target.studentId, amount: amountNum });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        await db
          .update(feeAllocationTargets)
          .set({ status: 'error', error: message, processedAt: nowIso })
          .where(eq(feeAllocationTargets.id, target.id));
        errors.push({ studentId: target.studentId, message });
      }
    }

    const previewSummary = {
      count: targets.length,
      included: created.length,
      errors: errors.length,
      totalCents: totalCents.toString(),
    };
    await db
      .update(feeAllocationRuns)
      .set({ status: 'completed', completedAt: nowIso, previewSummary })
      .where(eq(feeAllocationRuns.id, id));

    recordAudit(context, 'create', 'fee_allocation_run', id, { included: created.length, errors: errors.length, totalCents: totalCents.toString() });

    const total = Number(centsToMoney(totalCents));
    return NextResponse.json({
      success: true,
      data: { runId: id, included: created.length, errors: errors.length, total, firstInvoices: created.slice(0, 20) },
      message: `${created.length} facture(s) générée(s) pour un total de ${total.toFixed(2)} MAD${errors.length ? `, ${errors.length} erreur(s).` : '.'}`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
