import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { salaryAdvances, salaryAdvanceTransactions } from '@/models/Schema';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';

const createAdvanceSchema = z.object({
  requestedAmount: z.number().positive().max(500000),
  monthlyInstallment: z.number().positive().optional(),
  reason: z.string().trim().max(1000).optional(),
}).strict();

// GET /api/employee/me/advances — Own salary advances & ledger transactions
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId);
    await requireCapability(ctx, 'payroll.self.read');
    await resolveEmployeeContext(tenantId, ctx.userId);

    const advances = await db
      .select({
        id: salaryAdvances.id,
        requestedAmount: salaryAdvances.requestedAmount,
        approvedAmount: salaryAdvances.approvedAmount,
        repaidAmount: salaryAdvances.repaidAmount,
        monthlyInstallment: salaryAdvances.monthlyInstallment,
        reason: salaryAdvances.reason,
        status: salaryAdvances.status,
        requestedAt: salaryAdvances.requestedAt,
        approvedAt: salaryAdvances.approvedAt,
        rejectionReason: salaryAdvances.rejectionReason,
        createdAt: salaryAdvances.createdAt,
      })
      .from(salaryAdvances)
      .where(and(eq(salaryAdvances.tenantId, tenantId), eq(salaryAdvances.userId, ctx.userId)))
      .orderBy(desc(salaryAdvances.createdAt));

    // Fetch ledger transactions for active/repaying advances
    const advanceIds = advances.map(a => a.id);
    let transactions: Array<{
      id: string;
      advanceId: string;
      type: string;
      amount: number;
      transactionDate: string;
      notes: string | null;
    }> = [];

    if (advanceIds.length > 0) {
      const txRows = await db
        .select({
          id: salaryAdvanceTransactions.id,
          advanceId: salaryAdvanceTransactions.advanceId,
          type: salaryAdvanceTransactions.type,
          amount: salaryAdvanceTransactions.amount,
          transactionDate: salaryAdvanceTransactions.transactionDate,
          notes: salaryAdvanceTransactions.notes,
        })
        .from(salaryAdvanceTransactions)
        .where(eq(salaryAdvanceTransactions.tenantId, tenantId))
        .orderBy(desc(salaryAdvanceTransactions.createdAt));

      transactions = txRows
        .filter(t => advanceIds.includes(t.advanceId))
        .map(t => ({ ...t, amount: Number(t.amount) }));
    }

    const formattedAdvances = advances.map(a => {
      const req = Number(a.requestedAmount);
      const app = a.approvedAmount !== null ? Number(a.approvedAmount) : req;
      const rep = Number(a.repaidAmount);
      return {
        ...a,
        requestedAmount: req,
        approvedAmount: a.approvedAmount !== null ? app : null,
        repaidAmount: rep,
        remainingBalance: Math.max(0, app - rep),
        monthlyInstallment: a.monthlyInstallment !== null ? Number(a.monthlyInstallment) : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        advances: formattedAdvances,
        transactions,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// POST /api/employee/me/advances — Request a new salary advance
export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId);
    await requireCapability(ctx, 'payroll.self.read');
    const employee = await resolveEmployeeContext(tenantId, ctx.userId);

    const body = await parseJson(request, createAdvanceSchema);

    // Check if there is already a pending advance application
    const [existingPending] = await db
      .select({ id: salaryAdvances.id })
      .from(salaryAdvances)
      .where(and(
        eq(salaryAdvances.tenantId, tenantId),
        eq(salaryAdvances.userId, ctx.userId),
        eq(salaryAdvances.status, 'pending'),
      ))
      .limit(1);

    if (existingPending) {
      throw new ApiError(409, 'PENDING_ADVANCE_EXISTS', 'Une demande d\'avance est déjà en cours de traitement.');
    }

    let inserted: { id: string } | undefined;
    try {
      [inserted] = await db.insert(salaryAdvances).values({ tenantId, employeeId: employee.id, userId: ctx.userId, requestedAmount: body.requestedAmount, monthlyInstallment: body.monthlyInstallment ?? null, reason: body.reason ?? null, status: 'pending' }).returning({ id: salaryAdvances.id });
    } catch (error) {
      const pg = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
      if ((pg.code ?? pg.cause?.code) === '23505' && (pg.constraint ?? pg.cause?.constraint) === 'salary_advances_one_pending_per_user_idx') {
        throw new ApiError(409, 'PENDING_ADVANCE_EXISTS', 'Une demande d’avance est déjà en cours de traitement.');
      }
      throw error;
    }

    recordAudit(ctx, 'create', 'salary_advance', inserted!.id);

    return NextResponse.json({ success: true, data: { id: inserted!.id } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
