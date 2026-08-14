import { StudentTransfersView } from '@/features/students/ui/student-transfers-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function TransfersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <StudentTransfersView />;
}
