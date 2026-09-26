import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant, type RequestContext } from '@/libs/api/context';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { user } from '@/models/Schema';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import {
  certificateDefinitions,
  certificateDefinitionVersions,
  certificateEvents,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';


/** Campus lock: an issued certificate follows its recipient's campus. */
async function assertCertificateCampus(context: RequestContext, recipientId: string | null) {
  if (!recipientId) return;
  const [recipient] = await db
    .select({ branchId: user.branchId })
    .from(user)
    .where(eq(user.id, recipientId))
    .limit(1);
  assertBranchScope(context, recipient?.branchId ?? null);
}
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

    assertCertificateCampus(context, row?.certificate?.recipientId ?? null);
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
