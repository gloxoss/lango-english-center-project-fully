import { requireServerPage } from '@/libs/api/page-guard';
import { FinanceView } from '@/features/parent/ui/FinanceView';

export default async function ParentFinancePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  await requireServerPage(locale, { allowedRoles: ['parent'] });
  return <FinanceView />;
}
