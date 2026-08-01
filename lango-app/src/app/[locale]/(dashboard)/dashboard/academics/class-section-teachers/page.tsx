import { ClassSectionTeachersView } from '@/features/academics/ui/class-section-teachers-view';

export default async function ClassSectionTeachersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ClassSectionTeachersView locale={locale} />;
}
