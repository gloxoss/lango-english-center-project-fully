import { requireServerPage } from '@/libs/api/page-guard';
import { StaffManagementView } from '@/features/settings/ui/staff-view';

export default async function StaffManagementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <StaffManagementView locale={locale} />;
}
