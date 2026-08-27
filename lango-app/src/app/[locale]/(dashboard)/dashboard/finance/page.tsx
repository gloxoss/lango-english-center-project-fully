import { requireServerPage } from '@/libs/api/page-guard';
import AccountantDashboardPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'finance.read' });
  return <AccountantDashboardPage />;
}
