import { redirect } from 'next/navigation';
import { DashboardView } from '@/features/dashboard/ui/dashboard-view';
import { getServerUserContext } from '@/libs/auth/server-context';
import { resolveLandingPath } from '@/libs/api/portal-manifest';

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
  const landingPath = context ? await resolveLandingPath(context) : null;
  if (landingPath) {
    redirect(`/${locale}${landingPath}`);
  }
  return <DashboardView locale={locale} notice={notice ?? null} />;
}
