import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import {
  getRecipientNotifications,
  markNotificationAsRead,
} from '@/libs/services/notification-service';

// GET /api/notifications — list in-app notifications for the authenticated user.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unread') === 'true';

    const items = await getRecipientNotifications(
      context.userId,
      tenantId,
      unreadOnly,
    );

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const markReadSchema = z.object({
  id: z.string().uuid(),
}).strict();

// PATCH /api/notifications — mark notification as read.
export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, markReadSchema);

    await markNotificationAsRead(body.id, context.userId, tenantId);

    return NextResponse.json({ success: true, message: 'Notification marquée comme lue.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
