import { requireServerPage } from '@/libs/api/page-guard';
import StudentTransportPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['student'] });
  return <StudentTransportPage />;
}
