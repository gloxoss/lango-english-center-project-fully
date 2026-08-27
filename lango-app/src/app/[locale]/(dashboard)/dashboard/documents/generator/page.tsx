import { requireServerPage } from '@/libs/api/page-guard';
import { ReportCardGeneratorView } from '@/features/academics/ui/report-card-generator-view';

export default async function ReportCardGeneratorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'cards.templates.manage' });
  return <ReportCardGeneratorView locale={locale} />;
}
