import { requireServerPage } from '@/libs/api/page-guard';
import { FeeStructuresView } from '@/features/finance/ui/fee-structures-view';

// Fee structures (versioned) — server-guarded. Only `school_admin`/`accountant`
// roles with the finance.manage capability may reach this page.
export default async function FeeStructuresPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'accountant'], requiredCapability: 'finance.manage' });
  return <FeeStructuresView />;
}
