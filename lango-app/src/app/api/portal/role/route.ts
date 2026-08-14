import { z } from 'zod';
import { NextResponse } from 'next/server';
import {
  isAppRole,
  requireRequestContext,
  type AppRole,
} from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import {
  clearActiveContext,
  isRoleAssignable,
  persistActiveRole,
} from '@/features/portal/services/active-context';
import { recordPortalActivity } from '@/features/portal/services/portal-activity';
import { getPortalMe } from '@/features/portal/services/portal-me';

// ---------------------------------------------------------------------------
// POST /api/portal/role — server-validated active-role switch. The target role
// is checked against the principal's base role + live derived identities; a
// forged/unassigned switch gets one generic 403 FORBIDDEN. Success returns a
// fresh `/api/portal/me`. DELETE resets to the base role.
// ---------------------------------------------------------------------------

const switchSchema = z
  .object({
    role: z.string().min(1).max(30),
    branchId: z.string().uuid().nullable().optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const body = await parseJson(request, switchSchema);

    if (!isAppRole(body.role)) {
      throw new ApiError(400, 'INVALID_ROLE', 'Rôle invalide.');
    }
    const targetRole: AppRole = body.role;

    // A branch can only be persisted when it matches the already-active branch
    // (which the context derived from the session/header/principal). Never
    // accept an arbitrary branch id from the client.
    const targetBranchId = body.branchId ?? null;
    if (targetBranchId !== null && targetBranchId !== context.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Accès refusé.');
    }

    const assignable = await isRoleAssignable(
      context.tenantId,
      context.baseRole,
      context.userId,
      targetRole,
    );
    if (!assignable) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne disposez pas des autorisations nécessaires.');
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
      targetRole,
      targetBranchId,
    );

    if (context.tenantId) {
      recordAudit(context, 'permission_change', 'portal_active_context', context.sessionId, {
        fromRole: context.role,
        toRole: targetRole,
        branchId: targetBranchId,
      });
      void recordPortalActivity({
        tenantId: context.tenantId,
        userId: context.userId,
        role: targetRole,
        action: 'role_switch',
        entityType: 'portal_active_context',
        entityId: context.sessionId,
        metadata: { fromRole: context.role, toRole: targetRole, branchId: targetBranchId },
      });
    }

    // Return the fresh /api/portal/me computed against the new active role.
    const data = await getPortalMe({ ...context, role: targetRole, branchId: targetBranchId });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// DELETE /api/portal/role — reset to the base role.
export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request);
    if (context.sessionId) {
      await clearActiveContext(context.sessionId);
      if (context.tenantId) {
        recordAudit(context, 'permission_change', 'portal_active_context', context.sessionId, {
          fromRole: context.role,
          toRole: context.baseRole,
          reset: true,
        });
      }
    }
    const data = await getPortalMe({ ...context, role: context.baseRole });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
