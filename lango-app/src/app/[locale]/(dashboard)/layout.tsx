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

  return (
    <SubscriptionGate locale={locale} suspended={subscriptionSuspended}>
      <OnboardingGate locale={locale} incomplete={onboardingIncomplete}>
      <DashboardShell
        locale={locale}
        sidebar={<Sidebar locale={locale} />}
        header={<Header locale={locale} />}
      >
        {children}
      </DashboardShell>
      </OnboardingGate>
    </SubscriptionGate>
  );
}
