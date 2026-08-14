import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardView } from '@/features/dashboard/ui/dashboard-view';
import { auth } from '@/libs/auth';

// Role-specific landing pages: a role whose whole job lives in one module
// shouldn't land on the cross-module school dashboard first. Extend this
// map if another role gets the same kind of dedicated portal later.
const ROLE_LANDING_PAGE: Record<string, string> = {
  accountant: 'finance',
  guard: 'portals/guard',
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  const landingPage = role ? ROLE_LANDING_PAGE[role] : undefined;
  if (landingPage) {
    redirect(`/${locale}/dashboard/${landingPage}`);
  }
  return <DashboardView locale={locale} />;
}
