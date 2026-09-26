import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/shared/dashboard-shell';
import { Header } from '@/components/shared/header';
import { Sidebar } from '@/components/shared/sidebar';
import { TwoFactorRequired } from '@/components/auth/two-factor-required';
import { SubscriptionGate } from '@/components/auth/subscription-gate';
import { OnboardingGate } from '@/components/auth/onboarding-gate';
import { auth } from '@/libs/auth';
import { db } from '@/libs/DB';
import { requiresTwoFactor } from '@/libs/auth/two-factor-policy';
import { isSubscriptionBlocked } from '@/libs/subscriptions/subscription-gate-logic';
import { isSchoolOnboardingComplete } from '@/features/settings/services/onboarding-completeness';
import { casablancaTodayIso } from '@/libs/finance/today';
import { getCurrentSessionYear } from '@/libs/services/school-year';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { tenants, user as userTable } from '@/models/Schema';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // Alumni have their own separate self-service portal, never this staff
  // dashboard shell (future-implementation/alumni-portal).
  const [principal] = await db.select({ role: userTable.role }).from(userTable).where(eq(userTable.id, session.user.id)).limit(1);
  if (principal?.role === 'alumni') {
    redirect(`/${locale}/alumni`);
  }

  // Mandatory 2FA (plan #3): super_admin always; school_admin when the tenant
  // enables `security.requireTwoFactorForAdmins`. Render the enroll screen
  // instead of the shell so a non-enrolled admin cannot reach any dashboard
  // route while bypassing the policy.
  const userTfa = Boolean((session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled);
  if (!userTfa && await requiresTwoFactor(principal?.role, session.user.tenantId)) {
    return <TwoFactorRequired locale={locale} email={session.user.email} />;
  }

  // Subscription enforcement: a suspended/cancelled tenant (except super_admin)
  // is blocked from the dashboard shell and shown a renewal prompt instead. The
  // subscription settings page stays reachable (SubscriptionGate) so the admin
  // can still submit a renewal request.
  let subscriptionSuspended = false;
  const tenantId = session.user.tenantId;
  if (principal?.role !== 'super_admin' && tenantId) {
    const [tenant] = await db
      .select({ subscriptionStatus: tenants.subscriptionStatus })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    subscriptionSuspended = isSubscriptionBlocked(tenant?.subscriptionStatus ?? null);
  }

  // Onboarding gate: a freshly-provisioned school_admin whose required fields
  // are not yet filled is redirected to the onboarding wizard from every
  // dashboard route. The OnboardingGate client component handles path exemptions.
  let onboardingIncomplete = false;
  if (principal?.role === 'school_admin' && tenantId && !subscriptionSuspended) {
    onboardingIncomplete = !await isSchoolOnboardingComplete(tenantId);
  }

  // Expired school-year notice (SCF-02-04). The current year is the flagged
  // `session_years` row (OD1), so "the year has ended" is a fact about that
  // row, not about today's date matching some other row. Shown to the director
  // only: they are the one who can open the next year.
  let expiredYear: { name: string; endDate: string } | null = null;
  if (principal?.role === 'school_admin' && tenantId) {
    const currentYear = await getCurrentSessionYear(tenantId);
    if (currentYear && currentYear.endDate < casablancaTodayIso()) {
      expiredYear = { name: currentYear.name, endDate: currentYear.endDate };
    }
  }

  const t = await getTranslations({ locale, namespace: 'Settings' });

  return (
    <SubscriptionGate locale={locale} suspended={subscriptionSuspended}>
      <OnboardingGate locale={locale} incomplete={onboardingIncomplete}>
      <DashboardShell
        locale={locale}
        sidebar={<Sidebar locale={locale} />}
        header={<Header locale={locale} />}
        banner={expiredYear ? (
          <div
            role="status"
            className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
          >
            <span>
              {t('year_expired_notice', { year: expiredYear.name, date: expiredYear.endDate })}
            </span>
            <Link
              href={`/${locale}/dashboard/academics/calendar`}
              className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
            >
              {t('year_expired_action')}
            </Link>
          </div>
        ) : undefined}
      >
        {children}
      </DashboardShell>
      </OnboardingGate>
    </SubscriptionGate>
  );
}
