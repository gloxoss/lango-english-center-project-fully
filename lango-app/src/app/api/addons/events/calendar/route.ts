import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { listVisibleEvents } from '@/features/events/services/events-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    // super_admin has no tenant (global view): the calendar is empty for them,
    // so no per-tenant data is ever returned and no tenant leak is possible.
    if (!context.tenantId) {
      return NextResponse.json({ success: true, data: [] });
    }
    const tenantId = context.tenantId;
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.read');

    // 1. Fetch all visible events for the user (published only feeds the calendar)
    const events = await listVisibleEvents(tenantId, context.userId, context.role, { publishedOnly: true });

    // 2. Map to CalendarEventItem format expected by dashboard-calendar-widget
    const calendarItems = events.flatMap(event => {
      const venue = event.venues[0];
      return event.schedules.flatMap(schedule =>
        schedule.occurrences.map(occurrence => ({
          id: occurrence.id,
          title: event.title,
          type: event.eventType, // Can map to standard CalendarEventItem colors
          startDate: occurrence.startTime.slice(0, 10),
          endDate: occurrence.endTime.slice(0, 10),
          isAllDay: schedule.isAllDay,
          location: venue ? (venue.name ?? venue.venueType) : undefined,
          description: event.description,
          source: 'addon-events',
        }))
      );
    });

    // Sort by startDate
    calendarItems.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    return NextResponse.json({ success: true, data: calendarItems });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
