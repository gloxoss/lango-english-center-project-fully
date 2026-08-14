import { ExcelImportView } from '@/features/students/ui/excel-import-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function StudentImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ExcelImportView locale={locale} />;
}
