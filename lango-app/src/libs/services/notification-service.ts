import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { notifications } from '@/models/Schema';

export type CreateNotificationInput = {
  tenantId: string;
  recipientId: string;
  template: string;
  channel?: 'in_app' | 'email' | 'sms';
  data?: Record<string, unknown>;
};

/**
 * Enqueue a notification into the notification outbox.
 */
export async function sendNotification(input: CreateNotificationInput): Promise<string> {
  const [row] = await db
    .insert(notifications)
    .values({
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      channel: input.channel ?? 'in_app',
      template: input.template,
      data: input.data ?? null,
      status: 'pending',
    })
    .returning();

  return row!.id;
}

/**
 * Fetch notifications for a recipient (in-app feed).
 */
export async function getRecipientNotifications(
  recipientId: string,
  tenantId: string,
  unreadOnly = false,
  limit = 20,
) {
  const conditions = [
    eq(notifications.recipientId, recipientId),
    eq(notifications.tenantId, tenantId),
  ];

  if (unreadOnly) {
    conditions.push(eq(notifications.status, 'pending'));
  }

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/**
 * Mark notification as read.
 */
export async function markNotificationAsRead(
  notificationId: string,
  recipientId: string,
  tenantId: string,
) {
  const now = new Date().toISOString();
  await db
    .update(notifications)
    .set({
      status: 'sent',
      readAt: now,
      sentAt: now,
    })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.recipientId, recipientId),
      eq(notifications.tenantId, tenantId),
    ));
}
