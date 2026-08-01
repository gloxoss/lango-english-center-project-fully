import { TeachersBulkImportView } from '@/features/teachers/ui/teachers-bulk-import-view';

export default async function TeachersBulkImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TeachersBulkImportView locale={locale} />;
}
