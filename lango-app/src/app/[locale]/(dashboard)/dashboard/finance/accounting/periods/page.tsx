import { PeriodsView } from '@/features/accounting/ui/periods-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'accounting.statement.read' });
  return <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}><PeriodsView locale={locale} /></main>;
}
