import { requireServerPage } from '@/libs/api/page-guard';
import { FeeAllocationsView } from '@/features/finance/ui/fee-allocations-view';

// Fee allocations (preview → approve → run → invoices) — server-guarded. Only
// `school_admin`/`accountant` roles with the finance.manage capability may reach
// this page; the class-billing-status screen stays at /finance/allocation.
export default async function FeeAllocationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.manage' });
  return <FeeAllocationsView />;
}
