import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import {
  loadProviders, loadLogs, saveProviders, ProviderRecord,
} from './_lib';

// GET /api/settings/providers — real provider list + connection logs, seeded
// from the catalog on first load (idempotent).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.read');

    const [providers, logs] = await Promise.all([
      loadProviders(tenantId, context.branchId, context),
      loadLogs(tenantId, context.branchId),
    ]);

    return NextResponse.json({ success: true, providers, logs });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const providerCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  category: z.string().trim().min(1).max(100),
  providerName: z.string().trim().max(255).optional().default(''),
  endpointUrl: z.string().trim().min(1).max(2000),
  senderId: z.string().trim().max(200).optional().default(''),
}).strict();

// POST /api/settings/providers — add a provider. No secret/credential is
// accepted: the app has no encrypted secret store, so persisting a masked
// marker would falsely claim a usable credential exists. Reachability is the
// only thing this module tracks (see the test route).
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.integrations.manage');

    const body = await parseJson(request, providerCreateSchema);
    const providers = await loadProviders(tenantId, context.branchId, context);

    const provider: ProviderRecord = {
      id: randomUUID(),
      name: body.name,
      category: body.category,
      providerName: body.providerName,
      endpointUrl: body.endpointUrl,
      status: 'disconnected',
      latencyMs: 0,
      ownerName: '',
      quotaUsed: 0,
      quotaTotal: 0,
      quotaUnit: '',
      senderId: body.senderId,
      lastPing: 'Jamais',
    };
    providers.push(provider);
    await saveProviders(tenantId, context.branchId, providers, context);
    recordAudit(context, 'create', 'integration', provider.id, { name: provider.name });

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
