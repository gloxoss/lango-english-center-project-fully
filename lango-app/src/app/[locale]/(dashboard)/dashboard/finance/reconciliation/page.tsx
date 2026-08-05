import { BankReconciliationView } from '@/features/finance/ui/bank-reconciliation-view';

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <BankReconciliationView locale={locale} />;
}
