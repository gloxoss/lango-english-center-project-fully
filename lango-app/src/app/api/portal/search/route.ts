import { NextResponse } from 'next/server';
import { searchPortal } from '@/features/portal/services/portal-search';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireTenantId } from '@/libs/api/portal-scope';

// GET /api/portal/search?q= — role- and relationship-scoped search.
// Min 2 chars; each entity group is capability-gated and scoped (parent sees
// only linked children, students only themselves).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    // Search is inherently tenant-scoped; requireTenantId rejects a
    // tenantless principal (e.g. super_admin who has not chosen a tenant).
    requireTenantId(context);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        data: { students: [], teachers: [], invoices: [] },
      });
    }

    // No client branch parameter: searchPortal scopes from ctx.branchId.
    const data = await searchPortal(context, query);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
