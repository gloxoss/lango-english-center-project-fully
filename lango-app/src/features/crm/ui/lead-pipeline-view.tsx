import { LeadPipelinePage } from './lead-pipeline-page';

export async function LeadPipelineView({ locale }: { locale?: string } = {}) {
  return <LeadPipelinePage locale={locale} />;
}
