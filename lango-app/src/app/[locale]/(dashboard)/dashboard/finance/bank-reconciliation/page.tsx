import { BankReconciliationView } from '@/features/finance/ui/bank-reconciliation-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'accounting.reconcile' });
  return <BankReconciliationView />;
}
