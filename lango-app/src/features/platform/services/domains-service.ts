import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { tenantDomains } from '@/features/platform/models/domains-schema';
import { tenants } from '@/models/Schema';

export type ResolvedTenant = { slug: string; tenantId: string };

// Maps an approved tenant_domains row to its tenant, or null for an
// unknown/unapproved domain. The edge-tenant-resolve route and the sign-in
// scoping hook share this so the middleware resolution and the auth-flow
// enforcement always agree on the same mapping.
export async function resolveTenantByDomain(domain: string): Promise<ResolvedTenant | null> {
  const [record] = await db
    .select({ slug: tenants.slug, tenantId: tenants.id })
    .from(tenantDomains)
    .innerJoin(tenants, eq(tenantDomains.tenantId, tenants.id))
    .where(and(eq(tenantDomains.domain, domain), eq(tenantDomains.status, 'approved')))
    .limit(1);
  return record ?? null;
}

// All approved domains as bare hostnames. better-auth validates the Origin
// header of each request against trustedOrigins, so an anonymous visitor on a
// branded domain can sign in (and the scoping hook can then enforce the tenant).
export async function listApprovedDomains(): Promise<string[]> {
  const rows = await db
    .select({ domain: tenantDomains.domain })
    .from(tenantDomains)
    .where(eq(tenantDomains.status, 'approved'));
  return rows.map((r) => r.domain);
}
