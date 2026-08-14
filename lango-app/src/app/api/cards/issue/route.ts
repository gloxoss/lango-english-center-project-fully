import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { issueDocument } from '@/features/cards/services/issue-service';
import { documentEvents } from '@/features/cards/models/cards-schema';
import { db } from '@/libs/DB';

const issueSchema = z.object({
  templateVersionId: z.uuid(),
  subjectType: z.enum(['student', 'employee', 'exam_candidate']),
  subjectId: z.string().trim().min(1).max(255),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.issue');

    const body = await parseJson(request, issueSchema);
    const result = await issueDocument({
      tenantId,
      templateVersionId: body.templateVersionId,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      issuedBy: context.userId,
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
