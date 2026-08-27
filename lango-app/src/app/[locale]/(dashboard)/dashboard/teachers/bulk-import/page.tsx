import { requireServerPage } from '@/libs/api/page-guard';
import { TeachersBulkImportView } from '@/features/teachers/ui/teachers-bulk-import-view';

export default async function TeachersBulkImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'teachers.create' });
  return <TeachersBulkImportView locale={locale} />;
}
