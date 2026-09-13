import { requireServerPage } from '@/libs/api/page-guard';
import { TemplatesAutomationView } from '@/features/crm/ui/templates-automation-view';

export default async function TemplatesAutomationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'communication.send' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <TemplatesAutomationView locale={locale} />
    </main>
  );
}
