import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { loadProviders, saveProviders } from '../_lib';

type RouteParams = { params: Promise<{ id: string }> };

const providerUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  providerName: z.string().trim().max(255).optional(),
  endpointUrl: z.string().trim().min(1).max(2000).optional(),
  senderId: z.string().trim().max(200).optional(),
}).strict();

// PATCH /api/settings/providers/[id] — update editable fields. No credential
// input: the app has no encrypted secret store (see POST in ../route).
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.integrations.manage');

    const { id } = await params;
    const body = await parseJson(request, providerUpdateSchema);

    const providers = await loadProviders(tenantId, context.branchId, context);
    const index = providers.findIndex(p => p.id === id);
    if (index === -1) {
      throw new ApiError(404, 'PROVIDER_NOT_FOUND', 'Connexion introuvable.');
    }

    const current = providers[index]!;
    const updated: typeof current = {
      ...current,
      name: body.name ?? current.name,
      category: body.category ?? current.category,
      providerName: body.providerName ?? current.providerName,
      endpointUrl: body.endpointUrl ?? current.endpointUrl,
      senderId: body.senderId ?? current.senderId,
    };
    providers[index] = updated;
    await saveProviders(tenantId, context.branchId, providers, context);
    recordAudit(context, 'update', 'integration', id, { name: updated.name });

    return NextResponse.json({ success: true, provider: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
