import { requireServerPage } from '@/libs/api/page-guard';
import { LeadPipelineView } from '@/features/crm/ui/lead-pipeline-view';

export default async function LeadPipelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <LeadPipelineView locale={locale} />;
}
