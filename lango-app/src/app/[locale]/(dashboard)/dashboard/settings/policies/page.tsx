import { requireServerPage } from '@/libs/api/page-guard';
import { PoliciesView } from '@/features/settings/ui/policies-view';

export default async function PoliciesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.organization.manage' });
  return <PoliciesView locale={locale} />;
}
