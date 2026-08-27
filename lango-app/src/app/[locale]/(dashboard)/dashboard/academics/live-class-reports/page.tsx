import { requireLivePage } from '@/features/live-classrooms/ui/page-guard';
import { ReportsView } from '@/features/live-classrooms/ui/reports-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function LiveClassReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'live.reports.read' });
  await requireLivePage(locale, { requiredCapability: 'live.reports.read' });
  return <ReportsView />;
}
