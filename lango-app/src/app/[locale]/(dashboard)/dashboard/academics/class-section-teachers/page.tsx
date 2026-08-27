import { ClassSectionTeachersView } from '@/features/academics/ui/class-section-teachers-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ClassSectionTeachersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.manage' });
  return <ClassSectionTeachersView locale={locale} />;
}
