import { requireServerPage } from '@/libs/api/page-guard';
import { GuardVisitorsView } from '@/features/guard/ui/guard-visitors-view';

export default async function GuardVisitorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'guard.visitors.manage' });
  return <GuardVisitorsView />;
}
