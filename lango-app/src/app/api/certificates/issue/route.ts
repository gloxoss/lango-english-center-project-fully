import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { certificateRequests } from '@/features/certificates/models/certificates-schema';
import { issueCertificate } from '@/features/certificates/services/issue-service';

const issueSchema = z.object({
  definitionId: z.uuid(),
  definitionVersionId: z.uuid(),
  recipientType: z.enum(['student', 'employee']),
  recipientId: z.string().trim().min(1).max(255),
  ruleType: z.enum(['manual_authorized', 'enrollment_active', 'assessment_threshold', 'attendance_percentage', 'event_participation', 'hr_employment']),
  ruleParams: z.record(z.string(), z.unknown()).optional().default({}),
  requestId: z.uuid().nullable().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const body = await parseJson(request, issueSchema);

    if (body.requestId) {
      const [req] = await db.select().from(certificateRequests)
        .where(and(
          eq(certificateRequests.tenantId, tenantId),
          eq(certificateRequests.id, body.requestId),
        ))
        .limit(1);
      if (!req) {
        throw new ApiError(404, 'NOT_FOUND', 'Demande de certificat introuvable pour cet établissement.');
      }
      if (req.status !== 'approved') {
        throw new ApiError(400, 'REQUEST_NOT_APPROVED',
          'La demande doit être approuvée avant l\'émission (statut actuel: ' + req.status + ').');
      }
    }

    const result = await issueCertificate({
      tenantId,
      definitionId: body.definitionId,
      definitionVersionId: body.definitionVersionId,
      recipientType: body.recipientType,
      recipientId: body.recipientId,
      issuedBy: context.userId,
      ruleType: body.ruleType,
      ruleParams: body.ruleParams,
      requestId: body.requestId,
    });

    if (body.requestId) {
      await db.update(certificateRequests)
        .set({ status: 'issued', updatedAt: new Date().toISOString() })
        .where(and(
          eq(certificateRequests.tenantId, tenantId),
          eq(certificateRequests.id, body.requestId),
        ));
    }

    recordAudit(context, 'create', 'issued_certificate', result.issuedCertificate.id, {
      definitionId: body.definitionId,
      recipientType: body.recipientType,
      serialNumber: result.issuedCertificate.serialNumber,
      requestId: body.requestId ?? null,
    });

    return NextResponse.json({
      success: true,
      data: {
        issuedCertificate: result.issuedCertificate,
        rawToken: result.rawToken,
        pdfBase64: result.pdfBase64,
      },
      message: 'Certificat émis avec succès',
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
