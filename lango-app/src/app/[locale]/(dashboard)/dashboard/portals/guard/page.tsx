import { requireServerPage } from '@/libs/api/page-guard';
import { GuardHomeView } from '@/features/guard/ui/guard-home-view';

export default async function GuardPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Duty station: the page reads the viewer's own active shift, so a role that
  // can never hold one (school_admin, super_admin) is redirected like every
  // other role portal rather than shown a kiosk that 403s on load.
  await requireServerPage(locale, { allowedRoles: ['guard'], requiredCapability: 'guard.portal.use' });
  const isRtl = locale === 'ar';
  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>
      <GuardHomeView />
    </main>
  );
}
