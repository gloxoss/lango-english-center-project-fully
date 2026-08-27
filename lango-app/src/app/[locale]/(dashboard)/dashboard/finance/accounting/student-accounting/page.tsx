import { StudentAccountingView } from '@/features/accounting/ui/student-accounting-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'accounting.account.read' });
  return <main dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}><StudentAccountingView locale={locale} /></main>;
}
