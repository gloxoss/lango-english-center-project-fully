import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { issueDocument } from '@/features/cards/services/issue-service';
import { and, eq } from 'drizzle-orm';
import { documentEvents } from '@/features/cards/models/cards-schema';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

const issueSchema = z.object({
  templateVersionId: z.string().uuid(),
  subjectType: z.enum(['student', 'employee', 'exam_candidate']),
  subjectId: z.string().trim().min(1).max(255),
  reissue: z.boolean().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.issue');

    const body = await parseJson(request, issueSchema);

    // Branch authorization check for student subjects
    if (body.subjectType === 'student') {
      const [studentRow] = await db
        .select({ id: user.id, branchId: user.branchId })
        .from(user)
        .where(and(eq(user.id, body.subjectId), eq(user.tenantId, tenantId)))
        .limit(1);

      if (!studentRow) {
        throw new ApiError(404, 'NOT_FOUND', 'Élève introuvable pour cet établissement.');
      }

      if (context.branchId && studentRow.branchId && studentRow.branchId !== context.branchId) {
        throw new ApiError(403, 'FORBIDDEN', 'Accès interdit à cette succursale pour l\'émission de carte.');
      }
    }

    const result = await issueDocument({
      tenantId,
      templateVersionId: body.templateVersionId,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      issuedBy: context.userId,
      reissue: body.reissue,
    });

    recordAudit(context, 'create', 'issued_document', result.issuedDocument.id, {
      type: result.issuedDocument.type,
      subjectType: body.subjectType,
    });

    await db.insert(documentEvents).values({
      tenantId,
      issuedDocumentId: result.issuedDocument.id,
      eventKind: 'issued',
      actorId: context.userId,
      metadata: { subjectType: body.subjectType },
    });

    return NextResponse.json({
      success: true,
      data: {
        issuedDocument: result.issuedDocument,
        rawToken: result.rawToken,
        pdfBase64: result.pdfBase64,
      },
      message: 'Document émis avec succès',
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
