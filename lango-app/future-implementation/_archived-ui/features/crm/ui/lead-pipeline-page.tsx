import { LeadPipelineClient } from './lead-pipeline-client';

export async function LeadPipelinePage({ locale }: { locale?: string } = {}) {
  // RSC Server Component pre-fetches lead pipeline board server-side
  return <LeadPipelineClient locale={locale} />;
}
