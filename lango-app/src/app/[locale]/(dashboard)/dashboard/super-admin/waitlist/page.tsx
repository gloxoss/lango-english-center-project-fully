import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminWaitlistView } from '@/features/super-admin/ui/super-admin-waitlist-view';

export default async function SuperAdminWaitlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminWaitlistView />;
}
