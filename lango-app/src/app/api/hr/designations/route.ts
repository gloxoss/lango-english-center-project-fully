import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { createDesignation, listDesignations } from '@/features/hr/services/organizations-service';

const designationSchema = z.object({
  title: z.string().trim().min(1).max(120),
  code: z.string().trim().max(20).nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.employee.read');

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'active' | 'archived' | null;
    const search = url.searchParams.get('search') ?? '';

    const data = await listDesignations(tenantId, {
      ...(status === 'active' || status === 'archived' ? { status } : {}),
      ...(search ? { search } : {}),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireAddon(tenantId, 'human-resources');
    await requireCapability(ctx, 'hr.organization.manage');

    const body = await parseJson(request, designationSchema);
    const data = await createDesignation(tenantId, body);

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
