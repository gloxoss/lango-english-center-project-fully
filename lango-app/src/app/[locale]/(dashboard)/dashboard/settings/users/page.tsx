import { requireServerPage } from '@/libs/api/page-guard';
import { UsersRolesView } from '@/features/settings/ui/users-roles-view';

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'users.manage' });
  return <UsersRolesView locale={locale} />;
}
