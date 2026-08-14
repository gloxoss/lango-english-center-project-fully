// providers-view.tsx
// Re-exports ProvidersPage for backward compatibility with existing route imports.
import { ProvidersPage } from './providers-page';

export async function ProvidersView({ locale }: { locale?: string } = {}) {
  return <ProvidersPage locale={locale} />;
}
