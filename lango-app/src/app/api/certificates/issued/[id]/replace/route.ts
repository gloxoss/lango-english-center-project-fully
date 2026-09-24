import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { certificateDefinitions, certificateEvents, issuedCertificates } from '@/features/certificates/models/certificates-schema';
import { issueCertificate } from '@/features/certificates/services/issue-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const replaceSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.revoke');

    const body = await parseJson(request, replaceSchema);

    const [original] = await db.select().from(issuedCertificates).where(and(eq(issuedCertificates.tenantId, tenantId), eq(issuedCertificates.id, id))).limit(1);
    if (!original) {
      throw new ApiError(404, 'NOT_FOUND', 'Certificat émis introuvable pour cet établissement.');
    }
    if (original.status === 'replaced') {
      throw new ApiError(400, 'CERT_REPLACED', 'Ce certificat a déjà été remplacé.');
    }

    const [definition] = await db.select({ allowedTargetType: certificateDefinitions.allowedTargetType })
      .from(certificateDefinitions)
      .where(and(eq(certificateDefinitions.tenantId, tenantId), eq(certificateDefinitions.id, original.definitionId)))
      .limit(1);

    const recipientType = (definition?.allowedTargetType as 'student' | 'employee') || (original.recipientId.startsWith('STU-') ? 'student' : 'employee');

    const replacement = await issueCertificate({
      tenantId,
      definitionId: original.definitionId,
      definitionVersionId: original.versionId,
      recipientType,
      recipientId: original.recipientId,
      issuedBy: context.userId,
      ruleType: 'manual_authorized',
      ruleParams: { notes: body.reason ?? 'Correction / remplacement' },
    });

    await db.update(issuedCertificates)
      .set({ status: 'replaced' })
      .where(and(eq(issuedCertificates.tenantId, tenantId), eq(issuedCertificates.id, id)));

    await db.insert(certificateEvents).values({
      tenantId,
      issuedCertificateId: id,
      eventKind: 'replaced',
      actorId: context.userId,
      reason: body.reason,
      metadata: { replacementCertificateId: replacement.issuedCertificate.id },
    });

    recordAudit(context, 'update', 'issued_certificate', id, {
      replacedBy: replacement.issuedCertificate.id,
      reason: body.reason ?? null,
    });

    return NextResponse.json({
      success: true,
      data: {
        original: { ...original, status: 'replaced' as const },
        replacement: replacement.issuedCertificate,
        rawToken: replacement.rawToken,
        pdfBase64: replacement.pdfBase64,
      },
      message: 'Certificat remplacé avec succès (nouveau n° de série et nouveau jeton).',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
