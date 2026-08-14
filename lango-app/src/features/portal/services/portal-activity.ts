import { and, desc, eq } from 'drizzle-orm';
import type { AppRole } from '@/libs/api/context';
import { db } from '@/libs/DB';
import { portalActivityEvents } from '@/models/Schema';

// ---------------------------------------------------------------------------
// Portal activity audit trail — server-owned, tenant+user scoped.
// Writes are fire-and-forget (like recordAudit): never block a request on
// them. Reads are scoped to the actor's own rows in their own tenant.
// ---------------------------------------------------------------------------

export type PortalActivityInput = {
  tenantId: string;
  userId: string;
  role: AppRole;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function recordPortalActivity(input: PortalActivityInput): Promise<void> {
  await db
    .insert(portalActivityEvents)
    .values({
      tenantId: input.tenantId,
      userId: input.userId,
      role: input.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
    })
    .catch((err) => {
      console.error('Failed to record portal activity', { action: input.action, entityType: input.entityType, err });
    });
}

export async function getPortalActivity(tenantId: string, userId: string, limit = 20) {
  return db
    .select({
      id: portalActivityEvents.id,
      role: portalActivityEvents.role,
      action: portalActivityEvents.action,
      entityType: portalActivityEvents.entityType,
      entityId: portalActivityEvents.entityId,
      metadata: portalActivityEvents.metadata,
      createdAt: portalActivityEvents.createdAt,
    })
    .from(portalActivityEvents)
    .where(
      and(
        eq(portalActivityEvents.tenantId, tenantId),
        eq(portalActivityEvents.userId, userId),
      ),
    )
    .orderBy(desc(portalActivityEvents.createdAt))
    .limit(limit);
}
