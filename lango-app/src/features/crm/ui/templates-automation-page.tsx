import { TemplatesAutomationClient } from './templates-automation-client';

export async function TemplatesAutomationPage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches message templates server-side
  return <TemplatesAutomationClient locale={locale} />;
}
