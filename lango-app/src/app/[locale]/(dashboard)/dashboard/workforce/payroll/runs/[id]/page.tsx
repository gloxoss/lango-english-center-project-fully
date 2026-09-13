import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollRunDetail } from '@/features/workforce/ui/payroll-workspace';

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  await requireServerPage(locale, { requiredCapability: 'payroll.review' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <PayrollRunDetail id={id} />
    </main>
  );
}
