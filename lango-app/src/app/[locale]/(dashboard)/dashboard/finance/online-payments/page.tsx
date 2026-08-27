import { OnlinePaymentsView } from '@/features/finance/ui/online-payments-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.read' });
  return <OnlinePaymentsView />;
}
