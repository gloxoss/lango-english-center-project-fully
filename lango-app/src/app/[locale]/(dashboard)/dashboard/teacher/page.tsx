import { requireServerPage } from '@/libs/api/page-guard';
import { TeacherPortalView } from '@/features/teacher/ui/TeacherPortalView';

// Teacher portal — server-guarded. Only the `teacher` role may reach this
// self-service workspace; every other authenticated role is redirected.
export default async function TeacherPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['teacher'] });
  return <TeacherPortalView />;
}
