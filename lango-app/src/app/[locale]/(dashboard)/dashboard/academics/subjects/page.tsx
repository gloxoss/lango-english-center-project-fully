import { SubjectsView } from '@/features/academics/ui/subjects-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function SubjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.manage' });
  return <SubjectsView locale={locale} />;
}
