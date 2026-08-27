import { requireServerPage } from '@/libs/api/page-guard';
import { AuditLogsView } from '@/features/settings/ui/audit-logs-view';

export default async function AuditLogsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'audit.read' });
  return <AuditLogsView />;
}
