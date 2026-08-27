import { FeeAllocationView } from '@/features/finance/ui/fee-allocation-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.manage' });
  return <FeeAllocationView />;
}
