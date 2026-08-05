import { AssignmentWorkspaceView } from '@/features/academics/ui/assignment-workspace-view';

export default async function AssignmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AssignmentWorkspaceView locale={locale} />;
}
