import { ClassesView } from '@/features/academics/ui/classes-view';

export default async function ClassesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ClassesView locale={locale} />;
}
