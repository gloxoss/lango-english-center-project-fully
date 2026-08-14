import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { listAdapterExceptions } from '@/features/accounting/services/student-accounting-adapter';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.statement.read');
    const status = new URL(req.url).searchParams.get('status') ?? undefined;
    const data = await listAdapterExceptions({ tenantId, userId: ctx.userId }, status);
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}
