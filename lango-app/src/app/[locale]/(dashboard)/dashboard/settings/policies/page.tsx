import { requireServerPage } from '@/libs/api/page-guard';
import { PoliciesView } from '@/features/settings/ui/policies-view';

export default async function PoliciesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <PoliciesView locale={locale} />;
}
