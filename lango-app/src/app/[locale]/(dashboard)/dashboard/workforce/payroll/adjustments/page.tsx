import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollResource } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollResource resource="adjustments" />
    </main>
  );
}
