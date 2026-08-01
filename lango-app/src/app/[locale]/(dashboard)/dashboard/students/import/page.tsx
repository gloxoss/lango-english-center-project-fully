import { ExcelImportView } from '@/features/students/ui/excel-import-view';

export default async function StudentImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ExcelImportView locale={locale} />;
}
