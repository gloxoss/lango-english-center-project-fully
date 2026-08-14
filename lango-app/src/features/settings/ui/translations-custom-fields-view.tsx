// translations-custom-fields-view.tsx
// Re-exports TranslationsCustomFieldsPage for backward compatibility with existing route imports.
import { TranslationsCustomFieldsPage } from './translations-custom-fields-page';

export async function TranslationsCustomFieldsView({ locale }: { locale?: string } = {}) {
  return <TranslationsCustomFieldsPage locale={locale} />;
}
