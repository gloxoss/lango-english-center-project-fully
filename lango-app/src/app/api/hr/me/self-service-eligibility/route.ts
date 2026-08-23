import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

// Lightweight gate for the "Portail Employé" nav link: returns whether the
// signed-in user has an active (or retained read-only) employee profile,
// matching the exact eligibility the self-service page enforces server-side.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    if (!ctx.tenantId) {
      return NextResponse.json({ success: true, data: { eligible: false } });
    }
    let eligible = false;
    try {
      await resolveEmployeeContext(ctx.tenantId, ctx.userId, { allowRetainedReadOnly: true });
      eligible = true;
    } catch {
      eligible = false;
    }
    return NextResponse.json({ success: true, data: { eligible } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
