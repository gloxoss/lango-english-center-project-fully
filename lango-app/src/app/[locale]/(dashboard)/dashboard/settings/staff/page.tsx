import { StaffManagementView } from '@/features/settings/ui/staff-view';

export default async function StaffManagementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <StaffManagementView locale={locale} />;
}
