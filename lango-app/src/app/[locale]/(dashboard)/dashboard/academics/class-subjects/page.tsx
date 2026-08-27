import { ClassSubjectsView } from '@/features/academics/ui/class-subjects-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ClassSubjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.manage' });
  return <ClassSubjectsView locale={locale} />;
}
