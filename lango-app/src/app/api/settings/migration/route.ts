import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import {
  buildMigrationReadiness, loadMigrationState, saveMigrationState,
} from '@/libs/services/migration-readiness';
import { z } from 'zod';

const migrationActionSchema = z.object({
  validate: z.boolean().optional(),
  columnMappings: z.array(
    z.object({
      sourceCol: z.string().min(1),
      targetField: z.string().min(1),
    }),
  ).max(100).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    await requireCapability(context, 'settings.read');
    requireTenant(context);

    const data = await buildMigrationReadiness(context);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    await requireCapability(context, 'settings.organization.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, migrationActionSchema);

    if (body.columnMappings && body.columnMappings.length > 0) {
      const state = await loadMigrationState(tenantId, context.branchId, context);
      state.columnMappings = body.columnMappings;
      await saveMigrationState(tenantId, context.branchId, state, context);
      recordAudit(context, 'update', 'migration_state', tenantId, {
        action: 'save_mapping',
        count: body.columnMappings.length,
      });
    }
    if (body.validate) {
      recordAudit(context, 'update', 'migration_validation', tenantId, { action: 'trigger_validation' });
    }

    const data = await buildMigrationReadiness(context);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
