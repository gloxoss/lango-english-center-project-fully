import { SectionsView } from '@/features/academics/ui/sections-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function SectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.manage' });
  return <SectionsView locale={locale} />;
}
