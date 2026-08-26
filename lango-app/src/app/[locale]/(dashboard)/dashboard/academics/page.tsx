import { requireServerPage } from '@/libs/api/page-guard';
import { redirect } from 'next/navigation';

export default async function AcademicsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.read' });
  // classes/subjects/schedule are academics.manage (admin-only) - teacher-
  // schedule is the one academics.read child, and handles both teacher (own
  // schedule) and admin (picker) callers, so it's a safe universal landing.
  redirect(`/${locale}/dashboard/academics/teacher-schedule`);
}
