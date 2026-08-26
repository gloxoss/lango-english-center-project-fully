import { NextResponse } from 'next/server';
import { resolveTenantBySlug } from '@/features/website/services/website-service';
import { listPublicEvents } from '@/features/events/services/events-service';

// Public, unauthenticated event listing. Tenant is resolved strictly by slug
// (active tenants only); only published + public events are ever returned.
export async function GET(_request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ success: false, message: 'Établissement introuvable ou inactif.' }, { status: 404 });
  }
  const tenantId = tenant.id;
  const events = await listPublicEvents(tenantId);
  return NextResponse.json({ success: true, data: events });
}
