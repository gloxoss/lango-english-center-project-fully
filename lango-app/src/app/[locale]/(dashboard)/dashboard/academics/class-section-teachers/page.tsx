import { ClassSectionTeachersView } from '@/features/academics/ui/class-section-teachers-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ClassSectionTeachersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ClassSectionTeachersView locale={locale} />;
}
