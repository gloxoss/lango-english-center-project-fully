import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { tenantDomains } from '@/features/platform/models/domains-schema';
import { tenants } from '@/models/Schema';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    // Only super_admin can view all custom domains across tenants
    await requireRequestContext(request, ['super_admin']);

    // Fetch domains joined with tenant details
    const records = await db
      .select({
        domain: tenantDomains,
        tenant: {
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
        }
      })
      .from(tenantDomains)
      .leftJoin(tenants, eq(tenantDomains.tenantId, tenants.id))
      .orderBy(desc(tenantDomains.createdAt));

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
