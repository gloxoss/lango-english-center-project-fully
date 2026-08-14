import { requireServerPage } from '@/libs/api/page-guard';
import { HomeworkView } from '@/features/homework/ui/homework-view';

// This view is the teacher grading workspace (roster + files + grade entry).
// There is no separate student-facing "my homework" view yet, so this must
// stay teacher/school_admin/super_admin-only rather than open to students —
// unguarded, it exposed every classmate's real submitted files and grades to
// any logged-in student.
export default async function HomeworkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['teacher', 'school_admin', 'super_admin'] });
  return <HomeworkView />;
}
