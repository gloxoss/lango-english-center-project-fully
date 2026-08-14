import { LeadershipPortalView } from '@/features/crm/ui/leadership-portal-view';
import { requireLeadershipPage } from '@/features/leadership/ui/page-guard';

export default async function LeadershipPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireLeadershipPage(locale);

  return <LeadershipPortalView />;
}
