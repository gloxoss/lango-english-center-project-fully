import type { RequestContext } from './context';
import { db } from '@/libs/DB';
import { logger } from '@/libs/logger';
import { auditLogs } from '@/models/Schema';

type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'settings_change'
  | 'permission_change'
  | 'entitlement_change';

/**
 * Fire-and-forget: a logging failure must never fail the request it is
 *  recording. Errors are swallowed after being logged server-side.
 */
export function recordAudit(
  context: RequestContext,
  action: AuditAction,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): void {
  db
    .insert(auditLogs)
    .values({
      tenantId: context.tenantId,
      actorId: context.userId,
      action,
      entityType,
      entityId,
      metadata,
    })
    .catch((err) => {
      logger.error({ err, action, entityType, entityId }, 'Failed to record audit log');
    });
}
