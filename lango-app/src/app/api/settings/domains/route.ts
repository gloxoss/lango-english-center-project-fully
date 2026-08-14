import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/libs/DB';
import { tenantDomains } from '@/features/platform/models/domains-schema';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requirePlanTier } from '@/libs/api/permissions';
import { recordAudit } from '@/libs/api/audit';
import { eq, desc } from 'drizzle-orm';

const requestDomainSchema = z.object({
  domain: z.string().min(3).max(255),
  domainType: z.enum(['subdomain', 'custom']),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = context.tenantId;
    if (!tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Tenant required');

    const domains = await db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.tenantId, tenantId))
      .orderBy(desc(tenantDomains.createdAt));

    return NextResponse.json({ success: true, data: domains });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = context.tenantId;
    if (!tenantId) throw new ApiError(403, 'TENANT_REQUIRED', 'Tenant required');

    // Gate on plan tier
    await requirePlanTier(context, ['standard', 'premium']);

    const body = await request.json();
    const parsed = requestDomainSchema.parse(body);

    // Basic validation for subdomain vs custom domain format
    if (parsed.domainType === 'subdomain') {
      if (!/^[a-z0-9-]+$/.test(parsed.domain)) {
        throw new ApiError(400, 'BAD_REQUEST', 'Un sous-domaine ne peut contenir que des lettres minuscules, des chiffres et des tirets.');
      }
    } else {
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(parsed.domain)) {
        throw new ApiError(400, 'BAD_REQUEST', 'Format de domaine personnalisé invalide.');
      }
    }

    const [created] = await db.insert(tenantDomains).values({
      tenantId,
      domain: parsed.domain,
      domainType: parsed.domainType,
      status: 'pending',
      requestedById: context.userId,
    }).returning();

    if (created) {
      // Fire and forget audit
      recordAudit(context, 'create', 'tenant_domain', created.id, { domain: created.domain });
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
