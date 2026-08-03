import { AccountingDefaultsView } from '@/features/settings/ui/accounting-defaults-view';

export default async function AccountingDefaultsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AccountingDefaultsView locale={locale} />;
}
