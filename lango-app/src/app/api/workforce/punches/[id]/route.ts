import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { user, workforcePunchEvents } from '@/models/Schema';

/**
 * HR correction of a single punch (phase 9).
 *
 * The kiosk can only ever write the legally-next action, so it cannot fix a
 * mistake: someone who forgot to clock out leaves an open shift forever. This is
 * the deliberate, audited way to correct that, and it is why the correction
 * carries a mandatory reason, the actor and the before/after values.
 *
 * A correction is NOT re-validated against the punch sequence. HR is recording
 * what actually happened, and reality sometimes looks wrong on paper — two
 * entries in a row happen when a departure was missed and is added late. The
 * reason is what makes it accountable, not a rule that would refuse the fix.
 */
const correctionSchema = z.object({
  scannedAt: z.string().datetime().optional(),
  punchType: z.enum(['in', 'out']).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  reason: z.string().trim().min(3).max(500),
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    // Correcting a punch is an HR act, not a front-desk one: it rewrites the
    // record a payroll decision may later rest on.
    await requireCapability(context, 'hr.manage');

    const { id } = await params;
    const body = await parseJson(request, correctionSchema);

    const [existing] = await db
      .select()
      .from(workforcePunchEvents)
      .where(and(eq(workforcePunchEvents.id, id), eq(workforcePunchEvents.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Pointage introuvable.');
    }

    // BRANCH SCOPE: the punch belongs to an employee, so a campus-limited admin
    // corrects only their own campus's staff — same rule as the payroll run.
    const [employeeBranch] = await db
      .select({ branchId: user.branchId })
      .from(user)
      .where(and(eq(user.id, existing.employeeId), eq(user.tenantId, tenantId)))
      .limit(1);
    assertBranchScope(context, employeeBranch?.branchId ?? null);

    const before = {
      punchType: existing.punchType,
      scannedAt: existing.scannedAt,
      notes: existing.notes,
    };

    const updates: Record<string, unknown> = {};
    if (body.scannedAt !== undefined) {
      updates.scannedAt = body.scannedAt;
    }
    if (body.punchType !== undefined) {
      updates.punchType = body.punchType;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(422, 'NOTHING_TO_CORRECT', 'Aucune modification fournie.');
    }

    const [updated] = await db
      .update(workforcePunchEvents)
      .set(updates)
      .where(and(eq(workforcePunchEvents.id, id), eq(workforcePunchEvents.tenantId, tenantId)))
      .returning();

    const [employee] = await db
      .select({ name: user.name })
      .from(user)
      .where(and(eq(user.id, existing.employeeId), eq(user.tenantId, tenantId)))
      .limit(1);

    // The correction is itself the record: who changed what, from what, to what,
    // and why. Without the reason this is indistinguishable from tampering.
    recordAudit(context, 'update', 'workforce_punch', id, {
      reason: body.reason,
      before,
      after: {
        punchType: updated!.punchType,
        scannedAt: updated!.scannedAt,
        notes: updated!.notes,
      },
      employeeId: existing.employeeId,
    });

    return NextResponse.json({
      success: true,
      data: { punch: updated, employeeName: employee?.name ?? null },
      message: 'Pointage corrigé.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
