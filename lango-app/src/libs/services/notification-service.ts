import { and, desc, eq, isNull } from 'drizzle-orm';
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
 *
 * An in_app notification has no delivery step - the row itself is the
 * delivery, so it is born 'sent'. email/sms rows stay 'pending' until
 * something actually ships them.
 *
 * ponytail: there is no drainer for email/sms yet, so those rows queue up
 * and never leave. That is deliberately visible in the data (status stays
 * 'pending') rather than hidden behind a status that lies. Add a worker when
 * the first real email/sms channel ships.
 */
export async function sendNotification(input: CreateNotificationInput): Promise<string> {
  const channel = input.channel ?? 'in_app';
  const deliveredOnWrite = channel === 'in_app';

  const [row] = await db
    .insert(notifications)
    .values({
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      channel,
      template: input.template,
      data: input.data ?? null,
      status: deliveredOnWrite ? 'sent' : 'pending',
      sentAt: deliveredOnWrite ? new Date().toISOString() : null,
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

  // Unread is readAt IS NULL. Keying off status would call an undelivered
  // email "unread" and a delivered-but-unopened in-app message "read".
  if (unreadOnly) {
    conditions.push(isNull(notifications.readAt));
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
  // Only readAt. Reading a notification says nothing about whether it was
  // ever delivered, so this must not touch status/sentAt.
  await db
    .update(notifications)
    .set({
      readAt: new Date().toISOString(),
    })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.recipientId, recipientId),
      eq(notifications.tenantId, tenantId),
    ));
}
