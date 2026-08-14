import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminDomainsView } from '@/features/platform/ui/super-admin-domains-view';

export default async function SuperAdminDomainsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminDomainsView locale={locale} />;
}
