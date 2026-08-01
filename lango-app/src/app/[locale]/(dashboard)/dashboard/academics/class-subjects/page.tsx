import { ClassSubjectsView } from '@/features/academics/ui/class-subjects-view';

export default async function ClassSubjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ClassSubjectsView locale={locale} />;
}
