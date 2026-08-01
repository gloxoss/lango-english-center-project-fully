import { setRequestLocale } from 'next-intl/server';
import { BranchesManageView } from '@/features/settings/ui/branches-manage-view';

export default async function SettingsBranchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <BranchesManageView />;
}
