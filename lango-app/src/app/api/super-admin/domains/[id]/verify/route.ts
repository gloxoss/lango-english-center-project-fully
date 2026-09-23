import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { tenantDomains } from '@/features/platform/models/domains-schema';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { eq } from 'drizzle-orm';
import { verifyDomainDns } from '@/features/platform/services/dns-verification-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireRequestContext(request, ['super_admin']);
    const resolvedParams = await params;

    const [domainRecord] = await db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.id, resolvedParams.id))
      .limit(1);

    if (!domainRecord) {
      throw new ApiError(404, 'NOT_FOUND', 'Domaine introuvable.');
    }

    const verification = await verifyDomainDns(
      domainRecord.domain,
      domainRecord.verificationToken
    );

    // If DNS check succeeded and domain was pending, auto-mark it as verified
    let updatedStatus = domainRecord.status;
    if (verification.isFullyVerified && domainRecord.status === 'pending') {
      updatedStatus = 'verified';
      await db
        .update(tenantDomains)
        .set({ status: 'verified', updatedAt: new Date().toISOString() })
        .where(eq(tenantDomains.id, domainRecord.id));
    }

    const auditContext = { ...context, tenantId: domainRecord.tenantId };
    recordAudit(auditContext, 'update', 'tenant_domain', domainRecord.id, {
      action: 'verify_dns',
      isFullyVerified: verification.isFullyVerified,
      status: updatedStatus,
    });

    return NextResponse.json({
      success: true,
      data: {
        verification,
        status: updatedStatus,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
