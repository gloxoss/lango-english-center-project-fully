import { requireServerPage } from '@/libs/api/page-guard';
import { AccountantPortalView } from '@/features/finance/ui/accountant-portal-view';

// Dedicated accountant portal view for accounting role
export default async function AccountantPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.read' });
  return <AccountantPortalView />;
}
