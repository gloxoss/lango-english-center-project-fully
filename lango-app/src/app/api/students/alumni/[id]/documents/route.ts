import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { reserveVerificationCode } from '@/libs/services/alumni-verification-code';
import { alumniDocuments, user } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

// Same real validation already enforced for studentDocuments uploads - not
// leaving this new document type uncapped just because it's new
// (future-implementation/alumni-portal, Phase 4 review fix).
const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const { id: alumnusId } = await params;
    const rows = await db
      .select()
      .from(alumniDocuments)
      .where(and(eq(alumniDocuments.tenantId, tenantId), eq(alumniDocuments.alumnusId, alumnusId)))
      .orderBy(desc(alumniDocuments.issuedAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const { id: alumnusId } = await params;
    const formData = await req.formData();
    const documentType = formData.get('documentType');
    const file = formData.get('file');

    if (typeof documentType !== 'string' || !documentType.trim()) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'documentType requis.');
    }
    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const [alumnus] = await db.select({ id: user.id }).from(user)
      .where(and(eq(user.id, alumnusId), eq(user.tenantId, tenantId), eq(user.role, 'alumni')))
      .limit(1);
    if (!alumnus) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'ancien(ne) élève indiqué(e) n\'existe pas pour cet établissement.');
    }

    const documentId = randomUUID();
    const ext = await saveUploadedFile(tenantId, `alumni-documents/${alumnusId}/${documentId}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    const inserted = await db.transaction(async (tx) => {
      const verificationCode = await reserveVerificationCode(tx, tenantId);
      const [row] = await tx.insert(alumniDocuments).values({
        id: documentId,
        tenantId,
        alumnusId,
        documentType,
        fileExt: ext,
        verificationCode,
        status: 'active',
        issuedBy: context.userId,
      }).returning();
      return row;
    });

    recordAudit(context, 'create', 'alumni_document', inserted!.id, { documentType });

    return NextResponse.json({ success: true, data: inserted, message: 'Document délivré avec succès' }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
