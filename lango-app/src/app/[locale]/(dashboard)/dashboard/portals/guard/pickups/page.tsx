import { requireServerPage } from '@/libs/api/page-guard';
import { GuardPickupsView } from '@/features/guard/ui/guard-pickups-view';

export default async function GuardPickupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, {
    allowedRoles: ['guard', 'school_admin', 'super_admin'],
    requiredCapability: 'guard.portal.use',
  });
  return <GuardPickupsView />;
}
