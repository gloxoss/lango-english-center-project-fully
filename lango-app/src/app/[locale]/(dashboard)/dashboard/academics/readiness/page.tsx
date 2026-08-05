import { AcademicReadinessView } from '@/features/academics/ui/academic-readiness-view';

export default async function ReadinessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AcademicReadinessView locale={locale} />;
}
