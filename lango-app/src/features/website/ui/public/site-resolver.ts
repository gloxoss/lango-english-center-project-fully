import { cache } from 'react';
import { publicBrandingUrl } from '@/libs/api/uploads';
import { getPublicMenuItems, getPublicTheme, resolveTenantBySlug } from '@/features/website/services/website-service';

// React's cache() dedupes calls with identical args within a single request,
// so layout.tsx and every page.tsx under (school-site)/[tenantSlug] can each
// call resolveSite(tenantSlug) independently without re-querying the DB.
export const resolveSite = cache(async (tenantSlug: string) => {
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) {
    return null;
  }
  const theme = await getPublicTheme(tenant.id);
  const menu = theme ? await getPublicMenuItems(tenant.id) : [];
  // Resolved here, once, rather than in the header: `tenant.logoUrl` stays the
  // raw column, and `logoUrl` is a URL the browser can actually fetch, or null
  // when no file is behind the column. Guarding an <img> on the raw column is
  // what produced a 404ing image for a tenant with nothing uploaded.
  const logoUrl = await publicBrandingUrl(tenant, 'logo');
  return { tenant, logoUrl, theme, menu };
});

export type ResolvedSite = NonNullable<Awaited<ReturnType<typeof resolveSite>>>;
