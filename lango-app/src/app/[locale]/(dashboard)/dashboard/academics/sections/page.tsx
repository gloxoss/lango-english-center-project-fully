import { SectionsView } from '@/features/academics/ui/sections-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function SectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <SectionsView locale={locale} />;
}
