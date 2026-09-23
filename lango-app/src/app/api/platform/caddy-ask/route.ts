import { NextResponse } from 'next/server';
import { resolveTenantByDomain } from '@/features/platform/services/domains-service';
import { checkRateLimit } from '@/libs/api/rate-limit';

const PLATFORM_DOMAINS = new Set([
  'schoolos.epioso.com',
  'schoolos.ma',
  'app.schoolos.ma',
  'localhost',
  '127.0.0.1',
]);

/**
 * Caddy on_demand_tls Verification Endpoint.
 * Caddy issues an HTTP GET to this endpoint whenever an unknown TLS SNI handshake arrives.
 * If 200 is returned, Caddy obtains and caches a Let's Encrypt certificate.
 * If 403 is returned, Caddy aborts TLS negotiation.
 */
export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
    
    // Rate limit to prevent abuse: max 120 checks/min per IP
    try {
      checkRateLimit(`caddy_ask:${ip}`, 120, 60 * 1000);
    } catch {
      return new NextResponse('Rate limit exceeded', { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const rawDomain = searchParams.get('domain');

    if (!rawDomain) {
      return new NextResponse('Missing domain parameter', { status: 400 });
    }

    const cleanDomain = (rawDomain.trim().toLowerCase().split(':')[0] ?? '').trim();
    if (!cleanDomain) {
      return new NextResponse('Invalid domain parameter', { status: 400 });
    }

    // 1. Allow root platform domains and subdomains automatically
    // Exact platform hosts only. A blanket *.schoolos.* allow let any random
    // subdomain trigger a Let's Encrypt issuance and burn the weekly cert
    // quota; tenant subdomains are allowed below once registered.
    if (PLATFORM_DOMAINS.has(cleanDomain)) {
      return new NextResponse('Allowed platform domain', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // 2. Check if this is an approved school custom domain
    const tenantRecord = await resolveTenantByDomain(cleanDomain);

    if (tenantRecord) {
      return new NextResponse(`Allowed tenant domain for ${tenantRecord.slug}`, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Tenant-Slug': tenantRecord.slug,
          'X-Tenant-Id': tenantRecord.tenantId,
        },
      });
    }

    // Domain is either unverified, rejected, or unknown
    return new NextResponse('Forbidden: Domain not registered or pending verification', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('[caddy-ask] Verification error:', error);
    return new NextResponse('Internal server error during TLS domain authorization', { status: 500 });
  }
}
