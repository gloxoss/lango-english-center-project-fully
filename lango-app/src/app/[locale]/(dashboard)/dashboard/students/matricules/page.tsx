import { MatriculesView } from '@/features/students/ui/matricules-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function MatriculesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <MatriculesView />;
}
