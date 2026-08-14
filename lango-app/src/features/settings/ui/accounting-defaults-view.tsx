// accounting-defaults-view.tsx
// Re-exports AccountingDefaultsPage for backward compatibility with existing route imports.
import { AccountingDefaultsPage } from './accounting-defaults-page';

export async function AccountingDefaultsView({ locale }: { locale?: string } = {}) {
  return <AccountingDefaultsPage locale={locale} />;
}
