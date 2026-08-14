import { requireServerPage } from '@/libs/api/page-guard';
import TransportReportsPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <TransportReportsPage />;
}
