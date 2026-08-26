'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function OnboardingGate({
  locale,
  incomplete,
  children,
}: {
  locale: string;
  incomplete: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isOnboardingPage = pathname.endsWith('/dashboard/settings/onboarding');
  const isSubscriptionPage = pathname.endsWith('/dashboard/settings/subscription');

  useEffect(() => {
    if (incomplete && !isOnboardingPage && !isSubscriptionPage) {
      router.replace(`/${locale}/dashboard/settings/onboarding`);
    }
  }, [incomplete, isOnboardingPage, isSubscriptionPage, locale, router]);

  if (incomplete && !isOnboardingPage && !isSubscriptionPage) {
    return null;
  }
  return <>{children}</>;
}
