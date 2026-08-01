import { SubjectsView } from '@/features/academics/ui/subjects-view';

export default async function SubjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SubjectsView locale={locale} />;
}
