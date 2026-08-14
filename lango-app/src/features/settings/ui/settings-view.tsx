// settings-view.tsx
// Re-exports SettingsHubPage for backward compatibility with existing route imports.
import { SettingsHubPage } from './settings-hub-page';

export async function SettingsView({ locale }: { locale?: string } = {}) {
  return <SettingsHubPage locale={locale} />;
}
