// jobs-audit-view.tsx
// Re-exports JobsAuditPage for backward compatibility with existing route imports.
import { JobsAuditPage } from './jobs-audit-page';

export async function JobsAuditView({ locale }: { locale?: string } = {}) {
  return <JobsAuditPage locale={locale} />;
}
