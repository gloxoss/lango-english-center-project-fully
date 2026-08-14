import { LeadershipExceptionsClient } from '@/features/leadership/ui/leadership-exceptions-client';
import { requireLeadershipPage } from '@/features/leadership/ui/page-guard';

export default async function LeadershipExceptionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireLeadershipPage(locale);

  return <LeadershipExceptionsClient />;
}
