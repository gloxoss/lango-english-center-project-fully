import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardIncidentActionSchema } from '@/features/guard/models/guard-validation';
import { addIncidentAction, listIncidentActions } from '@/features/guard/services/incidents-service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.incidents.manage');
    const { id } = await params;
    const data = await listIncidentActions(context, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.incidents.manage');
    const { id } = await params;
    const body = await parseJson(request, guardIncidentActionSchema);
    const result = await addIncidentAction(context, id, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
