import { requireServerPage } from '@/libs/api/page-guard';
import { FormIntakeView } from '@/features/crm/ui/form-intake-view';

export default async function FormIntakePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'communication.send' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <FormIntakeView locale={locale} />
    </main>
  );
}
