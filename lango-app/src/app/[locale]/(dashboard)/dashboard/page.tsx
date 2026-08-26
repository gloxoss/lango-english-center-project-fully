import { redirect } from 'next/navigation';
import { DashboardView } from '@/features/dashboard/ui/dashboard-view';
import { isSchoolOnboardingComplete } from '@/features/settings/services/onboarding-completeness';
import { resolveLandingPath } from '@/libs/api/portal-manifest';
import { getServerUserContext } from '@/libs/auth/server-context';

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { locale } = await params;
  const { notice } = await searchParams;
  const context = await getServerUserContext();
  if (
    context?.baseRole === 'school_admin'
    && context.tenantId
    && !await isSchoolOnboardingComplete(context.tenantId)
  ) {
    redirect(`/${locale}/dashboard/settings/onboarding`);
  }
  const landingPath = context ? await resolveLandingPath(context) : null;
  if (landingPath) {
    redirect(`/${locale}${landingPath}`);
  }
  return <DashboardView locale={locale} notice={notice ?? null} />;
}
