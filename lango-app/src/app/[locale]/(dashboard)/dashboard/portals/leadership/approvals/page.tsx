import { LeadershipApprovalsClient } from '@/features/leadership/ui/leadership-approvals-client';
import { requireLeadershipPage } from '@/features/leadership/ui/page-guard';

export default async function LeadershipApprovalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireLeadershipPage(locale);

  return <LeadershipApprovalsClient />;
}
