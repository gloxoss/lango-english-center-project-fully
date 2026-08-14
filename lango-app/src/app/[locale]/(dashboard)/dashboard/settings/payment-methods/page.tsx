import { requireServerPage } from '@/libs/api/page-guard';
import { PaymentMethodsView } from '@/features/finance/ui/payment-methods-view';

// Payment methods — server-guarded finance configuration under Settings. Only
// `school_admin`/`accountant` roles with the finance.manage capability may
// reach this page.
export default async function PaymentMethodsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'accountant'], requiredCapability: 'finance.manage' });
  return <PaymentMethodsView />;
}
