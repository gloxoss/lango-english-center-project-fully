import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { getClassReportCards } from '@/features/academics/services/report-card-service';
import {
  ensureDefaultReportCardTemplate,
  issueReportCardDocument,
  issueReportCardPdf,
  resolveReportCardVersion,
} from '@/features/academics/services/report-card-document-service';

const issueSchema = z.object({
  templateVersionId: z.string().uuid().optional(),
  studentId: z.string().trim().min(1).optional(),
  classSectionId: z.string().uuid().optional(),
}).strict();

// POST /api/students/report-card/issue — issues bulletins as real report_card
// documents (pdfme PDF + issuedDocuments audit trail), single student or whole
// class. Without templateVersionId, a default bulletin template is used.
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const body = await parseJson(request, issueSchema);

    if (!body.studentId && !body.classSectionId) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'studentId ou classSectionId requis.');
    }

    const templateVersionId = body.templateVersionId
      ?? await ensureDefaultReportCardTemplate(tenantId, context.userId);

    if (body.studentId) {
      const { issuedDocument, pdfBase64 } = await issueReportCardPdf({
        tenantId,
        templateVersionId,
        studentId: body.studentId,
        issuedBy: context.userId,
      });
      recordAudit(context, 'create', 'issued_document', issuedDocument.id, { type: 'report_card', studentId: body.studentId });
      return NextResponse.json({ success: true, data: { issuedDocument, pdfBase64 } }, { status: 201 });
    }

    const version = await resolveReportCardVersion(tenantId, templateVersionId);
    const { cards } = await getClassReportCards(tenantId, body.classSectionId!);
    const toIssue = cards.filter(c => c.subjects.length > 0);

    const issuedIds: string[] = [];
    for (const card of toIssue) {
      const { issuedDocument } = await issueReportCardDocument({ tenantId, version, card, issuedBy: context.userId });
      issuedIds.push(issuedDocument.id);
    }

    recordAudit(context, 'create', 'document_generation_job', body.classSectionId!, {
      type: 'report_card',
      count: issuedIds.length,
    });

    return NextResponse.json({ success: true, data: { count: issuedIds.length, issuedDocumentIds: issuedIds } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
