import { requireServerPage } from '@/libs/api/page-guard';
import DocumentDesignPage from './page.client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.organization.manage' });
  return <DocumentDesignPage locale={locale} />;
}
