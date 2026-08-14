import { SubjectsView } from '@/features/academics/ui/subjects-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function SubjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <SubjectsView locale={locale} />;
}
