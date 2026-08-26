import { NextResponse } from 'next/server';
import { resolveTenantByDomain } from '@/features/platform/services/domains-service';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { apiErrorResponse } from '@/libs/api/errors';

// This is called by middleware.ts (Edge) to resolve hostnames to tenant slugs.
// It runs in the Node runtime where we have db access.
export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    // Rate limit edge tenant resolution requests to prevent domain enumeration floods
    checkRateLimit(`edge_tenant_resolve:${ip}`, 60, 60 * 1000);

    const bypassHeader = request.headers.get('x-middleware-bypass');
    if (bypassHeader !== '1' && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const domain = url.searchParams.get('domain')?.trim().toLowerCase();

    if (!domain || domain.length > 255) {
      return NextResponse.json({ success: false, error: 'Domain required' }, { status: 400 });
    }

    // Only verified/approved domains are active
    const record = await resolveTenantByDomain(domain);

    if (!record) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: { slug: record.slug, tenantId: record.tenantId } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
