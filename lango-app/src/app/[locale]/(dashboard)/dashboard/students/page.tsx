import { StudentsListView } from '@/features/students/ui/students-list-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function StudentDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'students.read' });
  return <StudentsListView locale={locale} />;
}
