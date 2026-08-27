import { RefundsView } from '@/features/finance/ui/refunds-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function RefundsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.manage' });
  return <RefundsView />;
}
