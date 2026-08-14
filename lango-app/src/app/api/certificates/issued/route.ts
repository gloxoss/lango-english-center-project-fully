import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import {
  certificateDefinitions,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const definitionId = url.searchParams.get('definitionId');

    const rows = await db.select({
      id: issuedCertificates.id,
      serialNumber: issuedCertificates.serialNumber,
      definitionId: issuedCertificates.definitionId,
      versionId: issuedCertificates.versionId,
      recipientId: issuedCertificates.recipientId,
      status: issuedCertificates.status,
      issuedAt: issuedCertificates.issuedAt,
      issuedBy: issuedCertificates.issuedBy,
      definitionTitle: certificateDefinitions.title,
      recipientName: user.name,
    })
      .from(issuedCertificates)
      .innerJoin(certificateDefinitions, and(
        eq(certificateDefinitions.id, issuedCertificates.definitionId),
        eq(certificateDefinitions.tenantId, tenantId),
      ))
      .leftJoin(user, eq(user.id, issuedCertificates.recipientId))
      .where(and(
        eq(issuedCertificates.tenantId, tenantId),
        status ? eq(issuedCertificates.status, status as 'valid' | 'replaced' | 'revoked') : undefined,
        definitionId ? eq(issuedCertificates.definitionId, definitionId) : undefined,
      ))
      .orderBy(desc(issuedCertificates.issuedAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
