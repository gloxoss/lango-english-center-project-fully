// security-sessions-view.tsx
// Re-exports SecuritySessionsPage for backward compatibility with existing route imports.
import { SecuritySessionsPage } from './security-sessions-page';

export async function SecuritySessionsView({ locale }: { locale?: string } = {}) {
  return <SecuritySessionsPage locale={locale} />;
}
