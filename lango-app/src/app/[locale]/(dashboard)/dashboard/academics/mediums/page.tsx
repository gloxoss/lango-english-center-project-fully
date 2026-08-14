import { MediumsView } from '@/features/academics/ui/mediums-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function MediumsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <MediumsView locale={locale} />;
}
