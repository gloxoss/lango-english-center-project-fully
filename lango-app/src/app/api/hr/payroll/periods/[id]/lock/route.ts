import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import {
  chartOfAccounts,
  fiscalPeriods,
  journalEntries,
  journalEntryLines,
  payrollPeriods,
  payrollRunLines,
  payslips,
} from '@/models/Schema';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/hr/payroll/periods/[id]/lock
//
// Atomic transaction:
// 1. Validate period is draft and has at least one calculated run line.
// 2. Post balanced GL journal (6111 → 4432/4441/4442) if accounts exist.
// 3. Create immutable payslip record for each run line.
// 4. Set period status = 'locked'.
// All steps in one db.transaction(). Rollback on any error.
// ─────────────────────────────────────────────────────────────────────────────

// Standard Moroccan payroll GL account codes (PCGE 2024)
const GL_SALARY_EXPENSE = '6111'; // Charges de personnel — salaires bruts
const GL_NET_PAYABLE = '4432';    // Personnel — rémunérations dues
const GL_CNSS_PAYABLE = '4441';   // CNSS — cotisations salariales
const GL_AMO_PAYABLE = '4442';    // AMO — cotisations salariales

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'hr.manage');
    const tenantId = requireTenant(ctx);
    const { id: periodId } = await params;

    const result = await db.transaction(async (tx) => {
      // Step 1: Load period and guard
      const [period] = await tx
        .select()
        .from(payrollPeriods)
        .where(and(eq(payrollPeriods.id, periodId), eq(payrollPeriods.tenantId, tenantId)))
        .limit(1);

      if (!period) {
        throw new ApiError(404, 'NOT_FOUND', 'Période de paie introuvable.');
      }
      if (period.status === 'locked') {
        throw new ApiError(409, 'PERIOD_LOCKED', 'Cette période est déjà verrouillée.');
      }

      // Step 2: Load run lines
      const lines = await tx
        .select()
        .from(payrollRunLines)
        .where(and(eq(payrollRunLines.periodId, periodId), eq(payrollRunLines.tenantId, tenantId)));

      if (lines.length === 0) {
        throw new ApiError(422, 'NO_RUN_LINES', 'Lancez d\'abord le calcul de la période avant de la verrouiller.');
      }

      // Step 3: Aggregate totals
      let totalGross = 0;
      let totalCnssEmp = 0;
      let totalAmoEmp = 0;
      let totalNet = 0;

      for (const l of lines) {
        totalGross += Number(l.grossSalary);
        totalCnssEmp += Number(l.cnssEmployee);
        totalAmoEmp += Number(l.amoEmployee);
        totalNet += Number(l.netSalary);
      }

      const fmt = (n: number) => n.toFixed(2);

      // Step 4: Post GL journal (conditional on fiscal period + accounts existing)
      let journalEntryId: string | null = null;

      const [openPeriod] = await tx
        .select({ id: fiscalPeriods.id })
        .from(fiscalPeriods)
        .where(and(eq(fiscalPeriods.tenantId, tenantId), eq(fiscalPeriods.status, 'open')))
        .limit(1);

      if (openPeriod) {
        // Look up required GL accounts
        const glCodes = [GL_SALARY_EXPENSE, GL_NET_PAYABLE, GL_CNSS_PAYABLE, GL_AMO_PAYABLE];
        const accounts = await tx
          .select({ id: chartOfAccounts.id, code: chartOfAccounts.code })
          .from(chartOfAccounts)
          .where(and(eq(chartOfAccounts.tenantId, tenantId), eq(chartOfAccounts.isActive, true)));

        const codeToId = new Map(accounts.map(a => [a.code, a.id]));
        const hasAllAccounts = glCodes.every(code => codeToId.has(code));

        if (hasAllAccounts) {
          const monthLabel = `${period.year}-${String(period.month).padStart(2, '0')}`;

          const [entry] = await tx.insert(journalEntries).values({
            tenantId,
            entryNumber: `PAY-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
            entryDate: `${period.year}-${String(period.month).padStart(2, '0')}-28`,
            description: `Paie du personnel — ${monthLabel}`,
            sourceModule: 'payroll',
            sourceId: periodId,
            postedById: ctx.userId,
            status: 'posted',
          }).returning();

          if (!entry) throw new ApiError(500, 'JOURNAL_FAILED', 'Impossible de créer l\'écriture comptable.');

          // Debit: 6111 Salaires bruts (total gross)
          // Credit: 4432 Net à payer
          // Credit: 4441 CNSS salarié
          // Credit: 4442 AMO salarié
          await tx.insert(journalEntryLines).values([
            {
              tenantId,
              journalEntryId: entry.id,
              accountId: codeToId.get(GL_SALARY_EXPENSE)!,
              debitAmount: fmt(totalGross),
              creditAmount: '0.00',
              memo: `Salaires bruts ${monthLabel}`,
            },
            {
              tenantId,
              journalEntryId: entry.id,
              accountId: codeToId.get(GL_NET_PAYABLE)!,
              debitAmount: '0.00',
              creditAmount: fmt(totalNet),
              memo: `Nets à payer ${monthLabel}`,
            },
            {
              tenantId,
              journalEntryId: entry.id,
              accountId: codeToId.get(GL_CNSS_PAYABLE)!,
              debitAmount: '0.00',
              creditAmount: fmt(totalCnssEmp),
              memo: `CNSS salarié ${monthLabel}`,
            },
            {
              tenantId,
              journalEntryId: entry.id,
              accountId: codeToId.get(GL_AMO_PAYABLE)!,
              debitAmount: '0.00',
              creditAmount: fmt(totalAmoEmp),
              memo: `AMO salarié ${monthLabel}`,
            },
          ]);

          journalEntryId = entry.id;
        }
        // else: no GL accounts configured → skip posting (not an error)
      }

      // Step 5: Create immutable payslip records
      await tx.insert(payslips).values(
        lines.map(line => ({
          tenantId,
          periodId,
          runLineId: line.id,
          userId: line.userId,
        })),
      );

      // Step 6: Lock the period
      const [locked] = await tx
        .update(payrollPeriods)
        .set({
          status: 'locked',
          lockedAt: new Date().toISOString(),
          lockedById: ctx.userId,
          journalEntryId,
        })
        .where(eq(payrollPeriods.id, periodId))
        .returning();

      return {
        period: locked,
        payslipsGenerated: lines.length,
        totalGross: fmt(totalGross),
        totalNet: fmt(totalNet),
        journalEntryId,
        glPosted: journalEntryId !== null,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
