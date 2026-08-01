import { TeachersManageView } from '@/features/teachers/ui/teachers-manage-view';

export default async function TeachersManagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TeachersManageView locale={locale} />;
}
