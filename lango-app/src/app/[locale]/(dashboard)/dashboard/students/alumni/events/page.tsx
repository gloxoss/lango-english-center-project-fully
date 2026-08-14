import { AlumniEventsView } from '@/features/students/ui/alumni-events-view';
import { requireServerPage } from '@/libs/api/page-guard';

export default async function AlumniEventsAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });
  return <AlumniEventsView />;
}
