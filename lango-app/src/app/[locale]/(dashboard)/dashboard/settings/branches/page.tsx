import { requireServerPage } from '@/libs/api/page-guard';
import { setRequestLocale } from 'next-intl/server';
import { BranchesManageView } from '@/features/settings/ui/branches-manage-view';

export default async function SettingsBranchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  setRequestLocale(locale);

  return <BranchesManageView />;
}
