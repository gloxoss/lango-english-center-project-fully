import { requireServerPage } from '@/libs/api/page-guard';
import { SuperAdminSubscriptionsView } from '@/features/super-admin/ui/super-admin-subscriptions-view';

export default async function SuperAdminSubscriptionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['super_admin'] });
  return <SuperAdminSubscriptionsView />;
}
