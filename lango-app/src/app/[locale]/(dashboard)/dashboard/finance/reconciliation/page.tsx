import { BankReconciliationView } from '@/features/finance/ui/bank-reconciliation-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['accountant', 'school_admin', 'super_admin'] });
  return <BankReconciliationView locale={locale} />;
}
