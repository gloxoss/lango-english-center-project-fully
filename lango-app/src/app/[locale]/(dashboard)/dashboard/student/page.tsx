import { requireServerPage } from '@/libs/api/page-guard';
import { StudentPortalView } from '@/features/student/ui/StudentPortalView';

// Student portal — server-guarded. Only the `student` role may reach this
// self-service workspace; every other authenticated role is redirected.
export default async function StudentPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['student'] });
  return <StudentPortalView />;
}
