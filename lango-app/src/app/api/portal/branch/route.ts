import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { branches } from '@/models/Schema';
import {
  isPatronRole,
  persistActiveRole,
} from '@/features/portal/services/active-context';

// ---------------------------------------------------------------------------
// POST /api/portal/branch — server-validated active-campus switch. The chosen
// branch is stored in the session's portal_active_contexts row (never in the
// browser) and revalidated on every read by resolveActiveContext. Locked staff
// (branchLocked) may not move off their assigned branch; whole-school staff may
// pick any ACTIVE branch of their own tenant or null ("Tous les sites"); the
// active role is kept unchanged. Patron roles are never branch-filtered and so
// cannot store a branch. Success returns `{ branchId, locked }`.
// ---------------------------------------------------------------------------

const branchSchema = z
  .object({
    branchId: z.string().uuid().nullable(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, branchSchema);

    if (isPatronRole(context.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Ce rôle n\'est pas concerné par le choix de campus.');
    }

    const targetBranchId = body.branchId ?? null;

    // A locked principal can never widen their scope: only their own branch
    // (an idempotent no-op) passes. For everyone else any active branch of
    // THIS tenant is accepted — the same check resolveActiveContext re-runs
    // on every read, so a forged or stale value cannot survive.
    if (context.branchLocked && targetBranchId !== context.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Votre compte est rattaché à un seul campus.');
    }
    if (targetBranchId !== null) {
      const [branch] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(
          and(
            eq(branches.id, targetBranchId),
            eq(branches.tenantId, tenantId),
            eq(branches.isActive, true),
          ),
        )
        .limit(1);
      if (!branch) {
        throw new ApiError(403, 'FORBIDDEN', 'Campus introuvable ou non autorisé.');
      }
    }

    if (!context.sessionId) {
      throw new ApiError(400, 'SESSION_REQUIRED', 'Session requise.');
    }

    await persistActiveRole(
      context.sessionId,
      {
        id: context.userId,
        tenantId: context.tenantId,
        baseRole: context.baseRole,
        branchId: context.branchId,
      },
      context.role,
      targetBranchId,
    );

    if (context.tenantId) {
      recordAudit(context, 'permission_change', 'portal_active_context', context.sessionId, {
        fromBranchId: context.branchId,
        toBranchId: targetBranchId,
        locked: context.branchLocked,
      });
    }

    return NextResponse.json({
      success: true,
      data: { branchId: targetBranchId, locked: context.branchLocked },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
