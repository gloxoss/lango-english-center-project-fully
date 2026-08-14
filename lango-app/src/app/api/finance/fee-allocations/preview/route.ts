import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { addDays, allocationComponentSchema } from '@/libs/finance/allocation';
import { centsToMoney, moneyToCents } from '@/libs/finance/money';
import { feeAllocationRuns, feeAllocationTargets, feeStructureVersions, user } from '@/models/Schema';

const previewSchema = z.object({
  period: z.string().trim().min(1).max(20),
  feeStructureVersionId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  studentIds: z.array(z.string().min(1)).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

// POST /api/finance/fee-allocations/preview — snapshot a population against a
// published structure version into a draft run with per-student targets whose
// amounts are derived from the version's immutable components.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'finance.manage');
    const body = await parseJson(request, previewSchema);
    const branchId = body.branchId ?? null;

    const [version] = await db
      .select()
      .from(feeStructureVersions)
      .where(and(eq(feeStructureVersions.id, body.feeStructureVersionId), eq(feeStructureVersions.tenantId, tenantId)))
      .limit(1);
    if (!version) {
      throw new ApiError(404, 'VERSION_NOT_FOUND', 'Version de structure tarifaire introuvable.');
    }
    if (version.status !== 'published') {
      throw new ApiError(422, 'VERSION_NOT_PUBLISHED', 'Seule une version publiée peut être facturée.');
    }
    const parsed = z.array(allocationComponentSchema).safeParse(version.componentsSnapshot);
    if (!parsed.success || parsed.data.length === 0) {
      throw new ApiError(422, 'VERSION_NO_COMPONENTS', 'La version publiée ne contient aucun composant facturable.');
    }
    const components = parsed.data;

    // Population: explicit studentIds (validated, de-duped, branch-consistent)
    // or every student of the tenant, optionally restricted to a branch.
    let studentIds = body.studentIds ? [...new Set(body.studentIds)] : [];
    if (studentIds.length > 0) {
      const valid = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), inArray(user.id, studentIds)));
      if (valid.length !== studentIds.length) {
        throw new ApiError(422, 'INVALID_POPULATION', 'Certains élèves de la population cible n\'existent pas.');
      }
      if (branchId) {
        const inBranch = await db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.tenantId, tenantId), eq(user.branchId, branchId), inArray(user.id, studentIds)));
        if (inBranch.length !== studentIds.length) {
          throw new ApiError(422, 'INVALID_POPULATION', 'Tous les élèves doivent appartenir à la branche sélectionnée.');
        }
      }
    } else {
      const conditions = [eq(user.tenantId, tenantId), eq(user.role, 'student')];
      if (branchId) conditions.push(eq(user.branchId, branchId));
      const rows = await db.select({ id: user.id }).from(user).where(and(...conditions));
      studentIds = rows.map(r => r.id);
    }
    if (studentIds.length === 0) {
      throw new ApiError(422, 'EMPTY_POPULATION', 'Aucun élève dans la population cible.');
    }

    // Money in BigInt cents, derived from the immutable version components.
    const amountCents = components.reduce((sum, c) => sum + moneyToCents(c.amount), BigInt(0));
    const maxOffset = components.reduce((max, c) => Math.max(max, c.dueOffsetDays), 0);
    const baseDueDate = body.dueDate ?? addDays(new Date().toISOString().slice(0, 10), 30);
    const amountPerStudent = Number(centsToMoney(amountCents));
    const totalCents = amountCents * BigInt(studentIds.length);

    const [run] = await db
      .insert(feeAllocationRuns)
      .values({
        tenantId,
        period: body.period,
        feeStructureVersionId: version.id,
        branchId,
        dueDate: baseDueDate,
        status: 'previewed',
        previewSummary: {
          count: studentIds.length,
          totalCents: totalCents.toString(),
          amountPerStudentCents: amountCents.toString(),
          baseDueDate,
          maxDueOffsetDays: maxOffset,
          dueDate: addDays(baseDueDate, maxOffset),
          componentCount: components.length,
          components: components.map(c => ({
            name: c.name,
            amount: c.amount,
            taxable: c.taxable,
            dueOffsetDays: c.dueOffsetDays,
          })),
        },
        runById: context.userId,
      })
      .returning();

    await db.insert(feeAllocationTargets).values(studentIds.map(sid => ({
      tenantId,
      runId: run!.id,
      studentId: sid,
      amount: amountPerStudent,
      status: 'pending',
    })));

    recordAudit(context, 'create', 'fee_allocation_preview', run!.id, { count: studentIds.length, totalCents: totalCents.toString() });

    return NextResponse.json({
      success: true,
      data: { run: run!, previewSummary: run!.previewSummary, targetCount: studentIds.length },
      message: `Aperçu d'allocation : ${studentIds.length} élève(s), ${Number(centsToMoney(totalCents)).toFixed(2)} MAD au total.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
