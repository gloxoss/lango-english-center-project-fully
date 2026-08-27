import { requireServerPage } from '@/libs/api/page-guard';
import ContentLibraryPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'content.manage' });
  return <ContentLibraryPage />;
}
