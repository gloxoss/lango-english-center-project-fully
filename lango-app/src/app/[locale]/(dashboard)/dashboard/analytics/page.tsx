import { requireServerPage } from '@/libs/api/page-guard';
import { LeadershipPortalView } from '@/features/crm/ui/leadership-portal-view';

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'analytics.read' });
  return <LeadershipPortalView />;
}
