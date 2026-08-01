import { UsersManageView } from '@/features/auth/ui/users-manage-view';

export default async function UsersSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <UsersManageView locale={locale} />;
}
