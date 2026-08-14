import { ClassesView } from '@/features/academics/ui/classes-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ClassesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ClassesView locale={locale} />;
}
