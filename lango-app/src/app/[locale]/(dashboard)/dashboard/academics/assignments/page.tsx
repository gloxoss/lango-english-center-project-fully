import { AssignmentWorkspaceView } from '@/features/academics/ui/assignment-workspace-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AssignmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AssignmentWorkspaceView locale={locale} />;
}
