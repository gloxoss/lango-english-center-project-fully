import { requireServerPage } from '@/libs/api/page-guard';
import { TranslationsCustomFieldsView } from '@/features/settings/ui/translations-custom-fields-view';

export default async function TranslationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <TranslationsCustomFieldsView locale={locale} />;
}
