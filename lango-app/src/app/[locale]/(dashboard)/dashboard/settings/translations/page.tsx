import { requireServerPage } from '@/libs/api/page-guard';
import { TranslationsCustomFieldsView } from '@/features/settings/ui/translations-custom-fields-view';

export default async function TranslationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'settings.translation.manage' });
  return <TranslationsCustomFieldsView locale={locale} />;
}
