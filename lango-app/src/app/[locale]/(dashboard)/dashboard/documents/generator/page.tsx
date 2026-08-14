import { requireServerPage } from '@/libs/api/page-guard';
import { ReportCardGeneratorView } from '@/features/academics/ui/report-card-generator-view';

export default async function ReportCardGeneratorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <ReportCardGeneratorView locale={locale} />;
}
