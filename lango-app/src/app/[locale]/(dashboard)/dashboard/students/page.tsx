import { StudentsListView } from '@/features/students/ui/students-list-view';

export default async function StudentDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <StudentsListView locale={locale} />;
}
