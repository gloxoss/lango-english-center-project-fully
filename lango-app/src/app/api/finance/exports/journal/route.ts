import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getAccountingExportAdapter } from '@/libs/finance/export/accounting-export-adapter';
import { buildStudentJournal } from '@/libs/finance/export/journal-extract';

// GET /api/finance/exports/journal?format=csv|xlsx&from=&to= — tenant-scoped
// student-accounting journal extract (invoices/payments/receipts/reversals/
// refunds/credits) streamed as a file download.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'accounting.export');

    const url = new URL(request.url);
    const format = (url.searchParams.get('format') ?? 'csv') as 'csv' | 'xlsx';
    if (format !== 'csv' && format !== 'xlsx') {
      return NextResponse.json({ success: false, message: 'Format inconnu (csv ou xlsx attendu).' }, { status: 400 });
    }
    const from = url.searchParams.get('from') ?? undefined;
    const to = url.searchParams.get('to') ?? undefined;

    const adapter = getAccountingExportAdapter(format);
    if (!adapter) {
      return NextResponse.json({ success: false, message: 'Adaptateur d\'export introuvable.' }, { status: 400 });
    }

    const rows = await buildStudentJournal(tenantId, { from, to });
    const result = await adapter.exportJournal(tenantId, rows);
    if (result.kind !== 'file' || !result.buffer) {
      return NextResponse.json({ success: false, message: result.message });
    }

    return new NextResponse(new Uint8Array(result.buffer) as unknown as BodyInit, {
      headers: {
        'Content-Type': result.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
