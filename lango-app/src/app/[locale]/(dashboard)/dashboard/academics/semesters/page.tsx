import { SemestersView } from '@/features/academics/ui/semesters-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function SemestersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <SemestersView locale={locale} />;
}
