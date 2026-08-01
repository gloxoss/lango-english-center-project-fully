import { DashboardView } from '@/features/dashboard/ui/dashboard-view';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <DashboardView locale={locale} />;
}
