import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { exportCopiesCsv } from '@/features/library/services/library-copies-csv';

export async function GET(r: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.copy.manage');
    const url = new URL(r.url);
    const { csv, count } = await exportCopiesCsv(tenantId, {
      query: url.searchParams.get('q') ?? undefined,
      state: url.searchParams.get('state') ?? undefined,
      branchId: url.searchParams.get('branchId') ?? undefined,
    });
    recordAudit(context, 'export', 'library_copy', tenantId, { format: 'csv', rows: count });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="copies-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) { return apiErrorResponse(e); }
}
