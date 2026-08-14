import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CatalogService } from '@/addons/advanced-reporting/services/catalog-service';
import { canAccessReport } from '@/addons/advanced-reporting/services/report-access';
import { RunEngine } from '@/addons/advanced-reporting/services/run-engine';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';

const previewSchema = z.object({
  parameters: z.record(z.string(), z.any()).optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const { key } = await params;
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'advanced-reporting');
    await requireCapability(context, 'reports.read');

    const definition = CatalogService.getDefinitionByKey(key);
    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Rapport introuvable.');
    }
    if (!canAccessReport(context.role, definition)) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne disposez pas des autorisations nécessaires pour ce rapport.');
    }

    const { parameters } = await parseJson(request, previewSchema);
    const previewData = await RunEngine.generatePreview(tenantId, key, parameters ?? {});
    return NextResponse.json({ success: true, data: previewData });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
