import { AssignmentWorkspaceView } from '@/features/academics/ui/assignment-workspace-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AssignmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.manage' });
  return <AssignmentWorkspaceView locale={locale} />;
}
