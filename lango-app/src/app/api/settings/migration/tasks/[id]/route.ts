import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { recordAudit } from '@/libs/api/audit';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { loadMigrationState, saveMigrationState } from '@/libs/services/migration-readiness';
import { z } from 'zod';

const updateTaskSchema = z.object({
  status: z.enum(['done', 'in_progress', 'pending', 'blocked']),
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    await requireCapability(context, 'settings.organization.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, updateTaskSchema);
    const taskId = Number(id);

    const state = await loadMigrationState(tenantId, context.branchId, context);
    const existing = state.tasks.find(t => t.id === taskId);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Tâche de migration introuvable.');
    }

    state.tasks = state.tasks.map(t => (t.id === taskId ? { ...t, status: body.status } : t));
    await saveMigrationState(tenantId, context.branchId, state, context);
    recordAudit(context, 'update', 'migration_task', id, { status: body.status });

    return NextResponse.json({
      success: true,
      data: { id: taskId, status: body.status, updatedAt: new Date().toISOString() },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
