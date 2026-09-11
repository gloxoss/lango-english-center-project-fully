import { requireServerPage } from '@/libs/api/page-guard';
import { GuardPickupsView } from '@/features/guard/ui/guard-pickups-view';

export default async function GuardPickupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Duty station: needs an active gate, so non-guard roles are redirected
  // (same as the teacher/student/parent portals) instead of hitting the kiosk's 403.
  await requireServerPage(locale, { allowedRoles: ['guard'], requiredCapability: 'guard.pickup.release' });
  return <GuardPickupsView />;
}
