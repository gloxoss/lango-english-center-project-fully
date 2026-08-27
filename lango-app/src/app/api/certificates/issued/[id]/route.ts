import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import {
  certificateDefinitions,
  certificateDefinitionVersions,
  certificateEvents,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const [row] = await db.select({
      certificate: issuedCertificates,
      definitionTitle: certificateDefinitions.title,
      definitionAllowedTargetType: certificateDefinitions.allowedTargetType,
      recipientName: user.name,
      versionNumber: certificateDefinitionVersions.versionNumber,
    })
      .from(issuedCertificates)
      .innerJoin(certificateDefinitions, and(
        eq(certificateDefinitions.id, issuedCertificates.definitionId),
        eq(certificateDefinitions.tenantId, tenantId),
      ))
      .innerJoin(certificateDefinitionVersions, and(
        eq(certificateDefinitionVersions.id, issuedCertificates.versionId),
        eq(certificateDefinitionVersions.tenantId, tenantId),
      ))
      .leftJoin(user, eq(user.id, issuedCertificates.recipientId))
      .where(and(
        eq(issuedCertificates.tenantId, tenantId),
        eq(issuedCertificates.id, id),
      ))
      .limit(1);

    if (!row) {
      throw new ApiError(404, 'NOT_FOUND', 'Certificat émis introuvable pour cet établissement.');
    }

    const events = await db.select().from(certificateEvents)
      .where(and(
        eq(certificateEvents.tenantId, tenantId),
        eq(certificateEvents.issuedCertificateId, id),
      ))
      .orderBy(asc(certificateEvents.createdAt));

    const detail = {
      ...row.certificate,
      definitionTitle: row.definitionTitle,
      definitionAllowedTargetType: row.definitionAllowedTargetType,
      recipientName: row.recipientName,
      versionNumber: row.versionNumber,
      events,
    };

    // teacher/receptionist can issue certificates but must not read the
    // eligibility evidence snapshot or the verification-token hash — those are
    // admin-only (evidence holds internal notes / grading / attendance figures).
    if (context.role === 'teacher' || context.role === 'receptionist') {
      const { evidenceSnapshot: _evidence, verificationTokenHash: _tokenHash, ...safe } = detail;
      return NextResponse.json({ success: true, data: safe });
    }

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
