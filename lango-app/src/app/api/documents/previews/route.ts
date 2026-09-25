import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { previewRequestSchema } from '@/features/documents/contracts';
import { resolveDesign } from '@/features/documents/services/designs';
import { loadFinanceDocument } from '@/features/documents/services/finance-loaders';
import { renderSchoolPdf } from '@/features/documents/services/pdf-renderer';
import { issuedFinancePdf } from '@/features/documents/services/issue-finance';
import { loadOtherDocument } from '@/features/documents/services/other-loaders';

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'accountant', 'teacher']);
    const tenantId = requireTenant(context);
    const input = await parseJson(request, previewRequestSchema);
    await requireCapability(context, input.kind === 'student_profile' ? 'students.read'
      : input.kind === 'leadership_report' ? 'analytics.read'
      : input.kind === 'exam_attendance' || input.kind === 'exam_seating' ? 'grading.manage'
      : input.kind === 'timetable' ? 'academics.read' : 'finance.read');
    if (input.useDraft && context.role !== 'school_admin') throw new ApiError(403, 'FORBIDDEN', 'Brouillon réservé à l’administrateur.');
    const [{ design }, model] = await Promise.all([
      resolveDesign(tenantId, input.kind, input.useDraft),
      input.kind === 'invoice' || input.kind === 'receipt' || input.kind === 'statement'
        ? loadFinanceDocument(request, context, input)
        : loadOtherDocument(request, context, input),
    ]);
    const bytes = (input.kind === 'receipt' || input.kind === 'invoice') && !input.useDraft && model.status !== 'draft'
      ? (await issuedFinancePdf(request, context, input.kind, input.sourceId)).bytes
      : await renderSchoolPdf(model, design, Boolean(input.useDraft) || model.status === 'draft' || model.status === 'Brouillon');
    recordAudit(context, 'export', 'document_preview', input.sourceId, { kind: input.kind, byteSize: bytes.length });
    const filename = model.filename.replace(/[^\w.-]/g, '_');
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Document-Current-Status': model.status ?? '',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
