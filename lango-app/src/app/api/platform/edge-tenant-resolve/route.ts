import { NextResponse } from 'next/server';
import { resolveTenantByDomain } from '@/features/platform/services/domains-service';

// This is called by middleware.ts (Edge) to resolve hostnames to tenant slugs.
// It runs in the Node runtime where we have db access.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');

  if (!domain) {
    return NextResponse.json({ success: false, error: 'Domain required' }, { status: 400 });
  }

  try {
    // Only verified/approved domains are active
    const record = await resolveTenantByDomain(domain);

    if (!record) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: { slug: record.slug, tenantId: record.tenantId } });
  } catch (error) {
    console.error('Error resolving edge tenant:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
