import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { parsePagination } from '@/libs/api/pagination';
import { parseJson } from '@/libs/api/validation';
import { receptionHandoffCreateSchema } from '@/features/reception/models/reception-validation';
import { createHandoff, listHandoffs } from '@/features/reception/services/handoffs-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.handoff.manage');
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const data = await listHandoffs(context, {
      status: searchParams.get('status'),
      assignedToMe: searchParams.get('assignedToMe') === 'true',
      limit: pagination.limit,
      offset: pagination.offset,
    });
    return NextResponse.json({ success: true, data: data.data, total: data.total });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.handoff.manage');
    checkRateLimit(`reception:handoff:create:${context.userId}`, 20, 60 * 1000);
    const body = await parseJson(request, receptionHandoffCreateSchema);
    const result = await createHandoff(context, body);
    return NextResponse.json({ success: true, data: result.handoff, created: result.created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
