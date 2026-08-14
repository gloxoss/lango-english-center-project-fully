import { requireServerPage } from '@/libs/api/page-guard';
import { TeachersBulkImportView } from '@/features/teachers/ui/teachers-bulk-import-view';

export default async function TeachersBulkImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <TeachersBulkImportView locale={locale} />;
}
