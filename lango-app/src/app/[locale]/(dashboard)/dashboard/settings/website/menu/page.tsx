import { requireServerPage } from '@/libs/api/page-guard';
import { MenuBuilderView } from '@/features/website/ui/menu-builder-view';

export default async function WebsiteMenuSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <MenuBuilderView />;
}
