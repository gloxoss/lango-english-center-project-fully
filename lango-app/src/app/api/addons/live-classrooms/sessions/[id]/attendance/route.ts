import { NextResponse } from 'next/server';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { getSummaries } from '@/features/live-classrooms/services/attendance-service';
import { loadSession } from '@/features/live-classrooms/services/session-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'live-classrooms');
    await requireCapability(context, 'live.attendance.read');

    const { id } = await params;
    // getSummaries is tenant-scoped, but a nonexistent/cross-tenant session
    // id would otherwise resolve to a silent empty array (200) rather than a
    // clear 404 — verify the session itself first.
    const session = await loadSession(tenantId, id);
    if (!session) throw new ApiError(404, 'NOT_FOUND', 'Session introuvable.');

    const summaries = await getSummaries(tenantId, id);
    return NextResponse.json({ success: true, data: summaries });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
