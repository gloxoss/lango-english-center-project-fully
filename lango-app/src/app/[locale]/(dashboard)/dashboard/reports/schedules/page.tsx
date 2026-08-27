import { requireServerPage } from '@/libs/api/page-guard';
import { SchedulesView } from '@/addons/advanced-reporting/ui/schedules-view';

export default async function SchedulesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'reports.schedule' });
  return <SchedulesView />;
}
