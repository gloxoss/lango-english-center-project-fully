import { ReportCardGeneratorView } from '@/features/academics/ui/report-card-generator-view';

export default async function ReportCardGeneratorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ReportCardGeneratorView locale={locale} />;
}
