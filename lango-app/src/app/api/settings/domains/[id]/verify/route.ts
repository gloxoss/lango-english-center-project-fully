import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { tenantDomains } from '@/features/platform/models/domains-schema';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { recordAudit } from '@/libs/api/audit';
import { and, eq } from 'drizzle-orm';
import { verifyDomainDns } from '@/features/platform/services/dns-verification-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = context.tenantId;
    if (!tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Tenant required');

    const resolvedParams = await params;

    // Enforce strict tenant isolation
    const [domainRecord] = await db
      .select()
      .from(tenantDomains)
      .where(
        and(
          eq(tenantDomains.id, resolvedParams.id),
          eq(tenantDomains.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!domainRecord) {
      throw new ApiError(404, 'NOT_FOUND', 'Domaine introuvable.');
    }

    const verification = await verifyDomainDns(
      domainRecord.domain,
      domainRecord.verificationToken
    );

    // If verified and pending, advance status
    let updatedStatus = domainRecord.status;
    if (verification.isFullyVerified && domainRecord.status === 'pending') {
      updatedStatus = 'verified';
      await db
        .update(tenantDomains)
        .set({ status: 'verified', updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(tenantDomains.id, domainRecord.id),
            eq(tenantDomains.tenantId, tenantId)
          )
        );
    }

    recordAudit(context, 'update', 'tenant_domain', domainRecord.id, {
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
