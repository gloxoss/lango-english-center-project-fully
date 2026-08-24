import { requireServerPage } from '@/libs/api/page-guard';
import { EventAdminDetailView } from '@/features/events/ui/event-admin-detail-view';

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireServerPage(locale, { allowedRoles: ['school_admin', 'super_admin'] });

  return <EventAdminDetailView eventId={id} locale={locale} />;
}
