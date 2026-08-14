import { requireServerPage } from '@/libs/api/page-guard';
import { NewsManagerView } from '@/features/website/ui/news-manager-view';

export default async function WebsiteNewsSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <NewsManagerView />;
}
