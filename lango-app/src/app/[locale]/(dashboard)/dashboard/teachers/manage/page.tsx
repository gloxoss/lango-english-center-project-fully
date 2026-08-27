import { requireServerPage } from '@/libs/api/page-guard';
import { TeachersManageView } from '@/features/teachers/ui/teachers-manage-view';

export default async function TeachersManagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'teachers.read' });
  return <TeachersManageView locale={locale} />;
}
