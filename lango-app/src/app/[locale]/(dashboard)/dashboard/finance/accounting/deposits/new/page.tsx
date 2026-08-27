import { AccountingDocumentForm } from '@/features/accounting/ui/accounting-document-form';
import { requireServerPage } from '@/libs/api/page-guard';
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'accounting.deposit.create' });
  return <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}><AccountingDocumentForm mode="deposit" locale={locale} /></main>;
}
