import { AlumniRequestsView } from '@/features/students/ui/alumni-requests-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AlumniRequestsAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AlumniRequestsView />;
}
