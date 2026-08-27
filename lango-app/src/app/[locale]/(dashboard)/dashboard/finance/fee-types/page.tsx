import { requireServerPage } from '@/libs/api/page-guard';
import { FeeTypesView } from '@/features/finance/ui/fee-types-view';

// Fee types — server-guarded. Only `school_admin`/`accountant` roles with the
// finance.manage capability may reach this page.
export default async function FeeTypesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.manage' });
  return <FeeTypesView />;
}
