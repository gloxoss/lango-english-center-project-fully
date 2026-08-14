import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireLibrarySelfContext } from '@/features/library/api/guard';
import { listChildLoans } from '@/features/library/services/library-service';

export async function GET(r: Request, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const { tenantId, context } = await requireLibrarySelfContext(r);
    const { studentId } = await params;
    return NextResponse.json({ success: true, data: await listChildLoans(tenantId, context.userId, studentId) });
  } catch (e) { return apiErrorResponse(e); }
}
