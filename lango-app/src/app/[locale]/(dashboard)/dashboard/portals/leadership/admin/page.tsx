import { LeadershipAdminClient } from '@/features/leadership/ui/leadership-admin-client';
import { requireLeadershipPage } from '@/features/leadership/ui/page-guard';

export default async function LeadershipAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireLeadershipPage(locale, { admin: true });

  return <LeadershipAdminClient />;
}
