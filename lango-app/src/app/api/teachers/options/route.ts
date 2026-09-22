import { NextResponse } from 'next/server';
import { listTeacherFilterOptions } from '@/features/teachers/server/teacher-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';

// Filter option lists for the directory, limited to the subjects, classes and
// branches actually attached to teachers the caller can see. This avoids
// loading the whole academic catalog into a filter dropdown and never leaks
// another campus's structure to a branch-limited principal.

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'teachers.read');

    // The selected branch is validated server-side inside the service.
    const branchId = new URL(request.url).searchParams.get('branchId');
    const options = await listTeacherFilterOptions(context, tenantId, branchId);
    return NextResponse.json({ success: true, data: options });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
