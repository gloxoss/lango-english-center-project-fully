import { notFound } from 'next/navigation';
import { resolveSite } from '@/features/website/ui/public/site-resolver';
import { SiteHeader } from '@/features/website/ui/public/site-header';
import { SiteFooter } from '@/features/website/ui/public/site-footer';
import { ComingSoon } from '@/features/website/ui/public/coming-soon';

// Public, unauthenticated per-tenant marketing site. Tenant is resolved
// strictly by [tenantSlug] (tenants.slug, already unique platform-wide) -
// every page under this route group scopes its content reads by the
// resolved tenantId, never by session, since visitors are not logged in.
export default async function SchoolSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; tenantSlug: string }>;
}) {
  const { locale, tenantSlug } = await params;
  const site = await resolveSite(tenantSlug);

  if (!site) {
    notFound();
  }

  if (!site.theme) {
    // No website_theme row, or the school toggled the site off - not a
    // broken half-page, a clean "coming soon" message instead.
    return <ComingSoon siteName={site.tenant.name} />;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ color: site.theme.colorText }}>
      <SiteHeader site={site} locale={locale} />
      <main className="flex-1">{children}</main>
      <SiteFooter site={site} />
    </div>
  );
}
