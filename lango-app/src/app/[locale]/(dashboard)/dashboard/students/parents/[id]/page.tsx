import { requireServerPage } from '@/libs/api/page-guard';
import GuardianDetailPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'guardians.read' });
  return <GuardianDetailPage />;
}
