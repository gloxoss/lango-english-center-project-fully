import { requireServerPage } from '@/libs/api/page-guard';
import { GuardEmergencyView } from '@/features/guard/ui/guard-emergency-view';

export default async function GuardEmergencyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, {
    allowedRoles: ['guard', 'school_admin', 'super_admin'],
    requiredCapability: 'guard.portal.use',
  });
  return <GuardEmergencyView />;
}
