import { headers } from 'next/headers';
import { TeacherScheduleView } from '@/features/academics/ui/teacher-schedule-view';
import { auth } from '@/libs/auth';

export default async function TeacherSchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const isTeacher = session?.user?.role === 'teacher';
  return <TeacherScheduleView locale={locale} isTeacher={isTeacher} />;
}
