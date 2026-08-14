// pf-01-migration-readiness-view.tsx
// Re-exports MigrationReadinessPage for backward compatibility with existing route imports.
import { MigrationReadinessPage } from './migration-readiness-page';

export async function MigrationReadinessCenterView({ locale }: { locale?: string } = {}) {
  return <MigrationReadinessPage locale={locale} />;
}
