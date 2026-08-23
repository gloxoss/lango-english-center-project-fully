import { CashierSessionsView } from '@/features/finance/ui/cashier-sessions-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function CashierSessionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['accountant', 'school_admin', 'super_admin'] });
  return <CashierSessionsView locale={locale} />;
}
