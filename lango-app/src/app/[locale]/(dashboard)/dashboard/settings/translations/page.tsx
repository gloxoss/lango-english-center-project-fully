import { TranslationsCustomFieldsView } from '@/features/settings/ui/translations-custom-fields-view';

export default async function TranslationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TranslationsCustomFieldsView locale={locale} />;
}
