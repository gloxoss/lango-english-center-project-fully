import { UsersRolesView } from '@/features/settings/ui/users-roles-view';

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <UsersRolesView locale={locale} />;
}
