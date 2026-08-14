import { cache } from 'react';
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
  return { tenant, theme, menu };
});

export type ResolvedSite = NonNullable<Awaited<ReturnType<typeof resolveSite>>>;
