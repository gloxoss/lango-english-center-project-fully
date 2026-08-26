'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Rendered by the dashboard shell when the tenant's subscription is suspended
// or cancelled. Self-contained so it does not depend on the sidebar/header
// hydration that the shell needs (mirrors TwoFactorRequired).
function SubscriptionSuspended({ locale }: { locale: string }) {
  return (
    <main className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="mx-auto w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
            Abonnement suspendu
          </h1>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            L&apos;abonnement de votre établissement est suspendu. Pour restaurer
            l&apos;accès, demandez le renouvellement de votre licence.
          </p>
        </div>
        <Link href={`/${locale}/dashboard/settings/subscription`}>
          <Button className="bg-[#0066FF] hover:bg-[#0052CC] text-white gap-2 text-xs font-bold h-10 rounded-xl">
            Gérer mon abonnement
          </Button>
        </Link>
        <p className="text-xs text-slate-400">
          Une question ? Contactez votre administrateur de plateforme.
        </p>
      </div>
    </main>
  );
}

// Client gate for the dashboard layout: shows the suspended screen for a
// suspended tenant, while leaving the subscription settings page reachable so
// the school_admin can actually submit a renewal request.
export function SubscriptionGate({
  locale,
  suspended,
  children,
}: {
  locale: string;
  suspended: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isRenewalPage = pathname.endsWith('/dashboard/settings/subscription');

  if (suspended && !isRenewalPage) {
    return <SubscriptionSuspended locale={locale} />;
  }
  return <>{children}</>;
}
