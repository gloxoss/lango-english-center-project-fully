import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { assertBranchScope, assertStudentBranchScope } from '@/libs/api/portal-scope';
import { getClassReportCards } from '@/features/academics/services/report-card-service';
import {
  ensureDefaultReportCardTemplate,
  issueReportCardDocument,
  issueReportCardPdf,
  resolveReportCardVersion,
} from '@/features/academics/services/report-card-document-service';
import { examTerms } from '@/features/assessment/models/assessment-schema';
import { db } from '@/libs/DB';
import { classSections, classes, sessionYears } from '@/models/Schema';

const issueSchema = z.object({
  templateVersionId: z.string().uuid().optional(),
  studentId: z.string().trim().min(1).optional(),
  classSectionId: z.string().uuid().optional(),
  examTermId: z.string().uuid().optional(),
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

    // Campus lock on the bulletin target: the student's campus, or the class's.
    if (body.studentId) {
      const studentScope = await assertStudentBranchScope(context, body.studentId, tenantId);
      if (!studentScope.exists) {
        throw new ApiError(404, 'NOT_FOUND', 'Élève introuvable dans cet établissement.');
      }
    } else {
      const [section] = await db
        .select({ branchId: classes.branchId })
        .from(classSections)
        .innerJoin(classes, eq(classes.id, classSections.classId))
        .where(and(eq(classSections.id, body.classSectionId!), eq(classSections.tenantId, tenantId)))
        .limit(1);
      if (!section) {
        throw new ApiError(404, 'NOT_FOUND', 'Classe introuvable dans cet établissement.');
      }
      assertBranchScope(context, section.branchId);
    }

    // Audit 3, P0-F: resolve the bulletin window (explicit exam term, else the
    // tenant's default session year) so issued bulletins never mix terms or years.
    let termWindow: { termStart?: string; termEnd?: string } = {};
    if (body.examTermId) {
      const [term] = await db
        .select({ startDate: examTerms.startDate, endDate: examTerms.endDate })
        .from(examTerms)
        .where(and(eq(examTerms.id, body.examTermId), eq(examTerms.tenantId, tenantId)))
        .limit(1);
      if (!term) {
        throw new ApiError(404, 'NOT_FOUND', "Session d'examen introuvable.");
      }
      termWindow = { termStart: term.startDate, termEnd: term.endDate };
    } else {
      const [year] = await db
        .select({ startDate: sessionYears.startDate, endDate: sessionYears.endDate })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);
      if (year) termWindow = { termStart: year.startDate, termEnd: year.endDate };
    }

    const templateVersionId = body.templateVersionId
      ?? await ensureDefaultReportCardTemplate(tenantId, context.userId);

    if (body.studentId) {
      const { issuedDocument, pdfBase64 } = await issueReportCardPdf({
        tenantId,
        templateVersionId,
        studentId: body.studentId,
        issuedBy: context.userId,
        termWindow,
      });
      recordAudit(context, 'create', 'issued_document', issuedDocument.id, { type: 'report_card', studentId: body.studentId });
      return NextResponse.json({ success: true, data: { issuedDocument, pdfBase64 } }, { status: 201 });
    }

    const version = await resolveReportCardVersion(tenantId, templateVersionId);
    // Audit 3, P0-F: issued bulletins are scoped to the requested exam term
    // (or the active session year) — never the student's entire history.
    const { cards } = await getClassReportCards(tenantId, body.classSectionId!, termWindow);
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
