import { requireServerPage } from '@/libs/api/page-guard';
import CardsJobsPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'cards.issue' });
  return <CardsJobsPage />;
}
