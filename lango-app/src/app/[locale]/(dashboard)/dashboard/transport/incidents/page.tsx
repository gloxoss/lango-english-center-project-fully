import { requireServerPage } from '@/libs/api/page-guard';
import IncidentsPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'transport.incident.read' });
  return <IncidentsPage />;
}
