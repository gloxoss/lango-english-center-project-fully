// users-roles-view.tsx
// Re-exports UsersRolesPage for backward compatibility with existing route imports.
import { UsersRolesPage } from './users-roles-page';

export async function UsersRolesView({ locale }: { locale?: string } = {}) {
  return <UsersRolesPage locale={locale} />;
}
