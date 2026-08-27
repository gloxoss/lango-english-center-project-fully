import { FeeAssignmentsView } from '@/features/finance/ui/fee-assignments-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function FeeAssignmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.manage' });
  return <FeeAssignmentsView />;
}
