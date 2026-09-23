import { requireServerPage } from '@/libs/api/page-guard';
import { EventAdminDetailView } from '@/features/events/ui/event-admin-detail-view';
import { EventFamilyDetailView } from '@/features/events/ui/event-family-detail-view';
import { getEventDetail } from '@/features/events/services/event-operations-service';
import { isFamilyEventViewerRole, resolveEventViewerContext } from '@/features/events/services/audience-service';
import { notFound } from 'next/navigation';
import { ApiError } from '@/libs/api/errors';

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await requireServerPage(locale, { requiredCapability: 'events.read' });
  if (isFamilyEventViewerRole(ctx.role)) {
    if (!ctx.tenantId) notFound();
    const viewer = await resolveEventViewerContext(ctx.userId, ctx.role);
    try {
      const detail = await getEventDetail(ctx.tenantId, id, viewer);
      return <EventFamilyDetailView detail={detail} locale={locale} />;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }
  }

  return <EventAdminDetailView eventId={id} locale={locale} />;
}
