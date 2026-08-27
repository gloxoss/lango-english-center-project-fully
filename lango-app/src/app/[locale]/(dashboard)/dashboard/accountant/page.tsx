import { requireServerPage } from '@/libs/api/page-guard';
import { AccountantPortalView } from '@/features/finance/ui/accountant-portal-view';

// Accountant portal — server-guarded. Only `accountant` and `school_admin`
// roles with the finance.read capability may reach this workspace; every other
// authenticated role is redirected.
export default async function AccountantPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.read' });
  return <AccountantPortalView />;
}
