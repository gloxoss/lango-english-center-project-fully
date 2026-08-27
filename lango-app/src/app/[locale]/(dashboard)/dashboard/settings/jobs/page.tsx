import { requireServerPage } from '@/libs/api/page-guard';
import { JobsAuditView } from '@/features/settings/ui/jobs-audit-view';

export default async function JobsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.jobs.manage' });
  return <JobsAuditView locale={locale} />;
}
