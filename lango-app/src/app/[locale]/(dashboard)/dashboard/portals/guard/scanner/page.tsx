import { requireServerPage } from '@/libs/api/page-guard';
import { GuardKioskShell } from '@/features/guard/ui/guard-kiosk-shell';

export default async function GuardScannerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Duty station: needs an active shift, so non-guard roles are redirected
  // (same as the teacher/student/parent portals) instead of hitting the kiosk's 403.
  await requireServerPage(locale, { allowedRoles: ['guard'], requiredCapability: 'guard.portal.use' });
  return <GuardKioskShell />;
}
