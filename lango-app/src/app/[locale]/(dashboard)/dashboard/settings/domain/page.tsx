import { requireServerPage } from '@/libs/api/page-guard';
import { SchoolAdminDomainsView } from '@/features/platform/ui/school-admin-domains-view';

export default async function SchoolAdminDomainsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.organization.manage' });
  return <SchoolAdminDomainsView locale={locale} />;
}
