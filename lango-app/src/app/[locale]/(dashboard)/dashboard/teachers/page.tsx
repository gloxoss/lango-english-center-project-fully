import { TeachersManageView } from '@/features/teachers/ui/teachers-manage-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function TeachersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'teachers.read' });
  return <TeachersManageView locale={locale} />;
}
