import { requireServerPage } from '@/libs/api/page-guard';
import { GuardVisitorsView } from '@/features/guard/ui/guard-visitors-view';

export default async function GuardVisitorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Duty station: needs an active gate, so non-guard roles are redirected
  // (same as the teacher/student/parent portals) instead of hitting the kiosk's 403.
  await requireServerPage(locale, { allowedRoles: ['guard'], requiredCapability: 'guard.visitors.manage' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardVisitorsView />
    </main>
  );
}
