import { requireServerPage } from '@/libs/api/page-guard';
import { UsersRolesView } from '@/features/settings/ui/users-roles-view';

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <UsersRolesView locale={locale} />;
}
