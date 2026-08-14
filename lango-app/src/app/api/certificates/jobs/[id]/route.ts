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
  certificateJobItems,
  certificateJobs,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const [job] = await db.select({
      job: certificateJobs,
      definitionTitle: certificateDefinitions.title,
    })
      .from(certificateJobs)
      .innerJoin(certificateDefinitions, and(
        eq(certificateDefinitions.id, certificateJobs.definitionId),
        eq(certificateDefinitions.tenantId, tenantId),
      ))
      .where(and(
        eq(certificateJobs.tenantId, tenantId),
        eq(certificateJobs.id, id),
      ))
      .limit(1);

    if (!job) {
      throw new ApiError(404, 'NOT_FOUND', 'Lot de certificats introuvable pour cet établissement.');
    }

    const items = await db.select({
      id: certificateJobItems.id,
      recipientId: certificateJobItems.recipientId,
      status: certificateJobItems.status,
      errorReason: certificateJobItems.errorReason,
      issuedCertificateId: certificateJobItems.issuedCertificateId,
      recipientName: user.name,
      serialNumber: issuedCertificates.serialNumber,
    })
      .from(certificateJobItems)
      .leftJoin(user, eq(user.id, certificateJobItems.recipientId))
      .leftJoin(issuedCertificates, eq(issuedCertificates.id, certificateJobItems.issuedCertificateId))
      .where(and(
        eq(certificateJobItems.tenantId, tenantId),
        eq(certificateJobItems.jobId, id),
      ))
      .orderBy(asc(certificateJobItems.id));

    return NextResponse.json({ success: true, data: { ...job.job, definitionTitle: job.definitionTitle, items } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
