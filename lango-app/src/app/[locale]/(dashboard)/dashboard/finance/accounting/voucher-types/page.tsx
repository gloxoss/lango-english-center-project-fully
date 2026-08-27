import { VoucherTypesView } from '@/features/accounting/ui/voucher-types-view';
import { requireServerPage } from '@/libs/api/page-guard';
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'accounting.account.manage' });
  return <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}><VoucherTypesView locale={locale} /></main>;
}
