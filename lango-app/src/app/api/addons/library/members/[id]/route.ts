import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireLibraryContext } from '@/features/library/api/guard';
import { getMemberDetail } from '@/features/library/services/library-service';

export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.circulation.operate');
    const { id } = await params;
    return NextResponse.json({ success: true, data: await getMemberDetail(tenantId, id) });
  } catch (e) { return apiErrorResponse(e); }
}
