import { ClassSubjectsView } from '@/features/academics/ui/class-subjects-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ClassSubjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ClassSubjectsView locale={locale} />;
}
