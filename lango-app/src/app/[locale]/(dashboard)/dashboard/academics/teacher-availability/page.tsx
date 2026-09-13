import { TeacherAvailabilityClient } from '@/features/academics/ui/teacher-availability-client';
import { requireServerPage } from '@/libs/api/page-guard';

/**
 * Teacher availability windows.
 *
 * This page shipped with no server guard at all, unlike every other dashboard
 * page — the API behind it checks the caller, but the page itself was reachable by
 * any authenticated role. `academics.read` is the right gate: admins manage the
 * grid and teachers set their own availability, and both hold it.
 */
export default async function TeacherAvailabilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireServerPage(locale, { requiredCapability: 'academics.read' });
  return <TeacherAvailabilityClient />;
}
