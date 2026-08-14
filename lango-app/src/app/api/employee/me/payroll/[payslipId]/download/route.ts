import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { getPayslip, renderPayslipHtml } from '@/features/hr/services/payslips';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';

// GET /api/employee/me/payroll/[payslipId]/download
// Serve the employee's own payslip as a printable bulletin.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ payslipId: string }> },
) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await resolveEmployeeContext(tenantId, ctx.userId, { allowRetainedReadOnly: true });

    const { payslipId } = await params;

    const row = await getPayslip(tenantId, payslipId, ctx.userId);
    if (!row) {
      throw new ApiError(404, 'NOT_FOUND', 'Bulletin de paie introuvable.');
    }

    // Payslips are immutable published snapshots - the download is always the
    // stored snapshot, never a recomputation.
    recordAudit(ctx, 'export', 'payslip', row.id);

    if (row.pdfStorageKey) {
      // A storage key exists but no storage backend is wired to serve it yet.
      throw new ApiError(501, 'PDF_STORAGE_NOT_CONFIGURED', 'Le fichier PDF de ce bulletin n\'est pas encore disponible au téléchargement.');
    }

    const month = String(row.month ?? 1).padStart(2, '0');
    const html = renderPayslipHtml(row);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="bulletin-${row.year}-${month}.html"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// No PATCH/PUT on payslips: they are immutable published snapshots. Any such
// attempt should 405 rather than silently do nothing.
export async function PATCH() {
  return NextResponse.json(
    { success: false, message: 'Les bulletins de paie sont immuables.' },
    { status: 405 },
  );
}
