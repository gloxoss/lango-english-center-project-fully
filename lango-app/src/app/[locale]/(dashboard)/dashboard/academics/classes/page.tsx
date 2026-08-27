import { ClassesView } from '@/features/academics/ui/classes-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ClassesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.manage' });
  return <ClassesView locale={locale} />;
}
