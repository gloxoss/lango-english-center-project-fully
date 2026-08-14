import { requireServerPage } from '@/libs/api/page-guard';
import { AccountingDefaultsView } from '@/features/settings/ui/accounting-defaults-view';

export default async function AccountingDefaultsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AccountingDefaultsView locale={locale} />;
}
