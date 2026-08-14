import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { broadcastGuard } from '@/features/broadcast/api/guard';
import { exportCampaignRows, exportToCsv } from '@/features/broadcast/services/reports-service';
import { recordAudit } from '@/libs/api/audit';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { context, tenantId } = await broadcastGuard(request, 'broadcast.export');
    const { id } = await params;
    const rows = await exportCampaignRows(tenantId, id);
    recordAudit(context, 'export', 'broadcast.campaign', id);
    return new NextResponse(exportToCsv(rows), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="campaign-${id}.csv"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
