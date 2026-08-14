import { requireServerPage } from '@/libs/api/page-guard';
import { PagesEditorView } from '@/features/website/ui/pages-editor-view';

export default async function WebsitePagesSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <PagesEditorView />;
}
