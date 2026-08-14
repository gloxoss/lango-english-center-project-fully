import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import {
  deleteProviderProfile, updateProviderProfile,
} from '@/features/live-classrooms/services/provider-profile-service';

const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  providerType: z.enum(['dev', 'bigbluebutton', 'external_link']).optional(),
  scope: z.enum(['tenant', 'platform']).optional(),
  baseUrl: z.string().trim().max(500).nullable().optional(),
  accountId: z.string().trim().max(120).nullable().optional(),
  // Reference key name only — raw credential values are never accepted or persisted.
  credentialRef: z.string().trim().max(120).nullable().optional(),
  credentialEncrypted: z.string().max(4000).nullable().optional(),
  // P1-4: env var name holding this profile's webhook secret — reference
  // only, never the raw value.
  webhookSecretRef: z.string().trim().max(120).nullable().optional(),
  enabled: z.boolean().optional(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.providers.manage');

    const { id } = await params;
    const body = await parseJson(request, profileUpdateSchema);
    const profile = await updateProviderProfile(tenantId, id, body);
    recordAudit(context, 'update', 'live_class_provider_profile', id, { name: profile.name });
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.providers.manage');

    const { id } = await params;
    await deleteProviderProfile(tenantId, id);
    recordAudit(context, 'update', 'live_class_provider_profile', id, { action: 'delete' });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
