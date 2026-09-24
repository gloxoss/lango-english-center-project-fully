import { LeadershipAdminClient } from '@/features/leadership/ui/leadership-admin-client';
import { requireLeadershipPage } from '@/features/leadership/ui/page-guard';
import { hasAddon } from '@/libs/api/entitlements';
import { getServerUserContext } from '@/libs/auth/server-context';

export default async function LeadershipAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireLeadershipPage(locale, { admin: true });
  // Department scopes need the HR add-on; without it /api/hr/departments 403s (audit S-22).
  const ctx = await getServerUserContext();
  const hrEnabled = ctx?.tenantId ? await hasAddon(ctx.tenantId, 'human-resources') : false;

  return <LeadershipAdminClient hrEnabled={hrEnabled} />;
}
