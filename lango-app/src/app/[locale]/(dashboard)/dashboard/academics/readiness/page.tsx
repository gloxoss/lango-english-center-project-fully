import { AcademicReadinessView } from '@/features/academics/ui/academic-readiness-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ReadinessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AcademicReadinessView locale={locale} />;
}
