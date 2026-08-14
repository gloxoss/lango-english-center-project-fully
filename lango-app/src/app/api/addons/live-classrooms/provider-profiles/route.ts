import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import {
  createProviderProfile, listProviderProfiles,
} from '@/features/live-classrooms/services/provider-profile-service';

const profileCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  providerType: z.enum(['dev', 'bigbluebutton', 'external_link']),
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

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.providers.manage');

    const profiles = await listProviderProfiles(tenantId);
    return NextResponse.json({ success: true, data: profiles });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.providers.manage');

    const body = await parseJson(request, profileCreateSchema);
    const profile = await createProviderProfile(tenantId, body);
    recordAudit(context, 'create', 'live_class_provider_profile', profile.id, { name: profile.name, providerType: profile.providerType });
    return NextResponse.json({ success: true, data: profile }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
