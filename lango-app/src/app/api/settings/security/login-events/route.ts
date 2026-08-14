import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { listLoginEvents } from '@/features/settings/services/login-events-service';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  success: z.enum(['true', 'false']).optional(),
  email: z.string().trim().max(255).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.security.manage');

    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const result = await listLoginEvents(tenantId, {
      page: query.page,
      limit: query.limit,
      success: query.success === undefined ? undefined : query.success === 'true',
      email: query.email,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
