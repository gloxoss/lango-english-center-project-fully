import { requireServerPage } from '@/libs/api/page-guard';
import { FinePoliciesView } from '@/features/finance/ui/fine-policies-view';

// Fine policies — server-guarded. Only `school_admin`/`accountant` roles with
// the finance.manage capability may reach this page.
export default async function FinePoliciesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.manage' });
  return <FinePoliciesView />;
}
