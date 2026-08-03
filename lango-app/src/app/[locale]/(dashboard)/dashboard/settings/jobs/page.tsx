import { JobsAuditView } from '@/features/settings/ui/jobs-audit-view';

export default async function JobsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <JobsAuditView locale={locale} />;
}
