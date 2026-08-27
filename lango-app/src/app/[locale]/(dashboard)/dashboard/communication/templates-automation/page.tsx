import { requireServerPage } from '@/libs/api/page-guard';
import { TemplatesAutomationView } from '@/features/crm/ui/templates-automation-view';

export default async function TemplatesAutomationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'communication.send' });
  return <TemplatesAutomationView locale={locale} />;
}
