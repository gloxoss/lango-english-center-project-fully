import { TemplatesAutomationPage } from './templates-automation-page';

export async function TemplatesAutomationView({ locale }: { locale?: string } = {}) {
  return <TemplatesAutomationPage locale={locale} />;
}
